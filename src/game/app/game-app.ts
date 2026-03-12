import customersConfig from '@data/configs/customers.json';
import economyConfig from '@data/configs/economy.json';
import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { CustomerState, GameState, Order, SaveData } from '@shared/types/state';

type CustomerArchetype = (typeof customersConfig.archetypes)[number];

export class GameApp {
  private readonly economy = new EconomySystem();
  private idCounter = 0;

  public constructor(
    private readonly eventBus: EventBus,
    private readonly state: GameState,
  ) {}

  public tick(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.state.timing.totalSessionSeconds += deltaSeconds;
    this.state.timing.lastActiveTimestampUtcMs = Date.now();

    this.updatePatience(deltaSeconds);
    this.spawnCustomers(deltaSeconds);
    this.moveWaitingCustomersToOrders();
    this.startBrewingIfPossible();
    this.processBrewing(deltaSeconds);
  }

  public sellCoffee(): void {
    this.serveReadyOrder();
  }

  public tryBuyEquipmentUpgrade(): boolean {
    const cost = this.economy.computeEquipmentUpgradeCost(this.state);
    if (this.state.player.wallet.soft < cost) {
      return false;
    }

    this.state.player.wallet.soft -= cost;
    this.state.cafe.equipmentLevel += 1;
    this.state.cafe.manualSaleIncome = Math.round(this.state.cafe.manualSaleIncome * 1.25);
    this.state.cafe.passiveIncomePerSecond = Number((this.state.cafe.passiveIncomePerSecond * 1.2).toFixed(2));

    this.eventBus.emit({ type: 'economy.moneySpent', amount: cost });
    this.eventBus.emit({
      type: 'upgrade.bought',
      upgradeId: 'espresso_machine_level',
      newLevel: this.state.cafe.equipmentLevel,
    });

    return true;
  }

  public getEquipmentUpgradeCost(): number {
    return this.economy.computeEquipmentUpgradeCost(this.state);
  }

  public computeOfflineIncome(_nowUtcMs: number, _maxOfflineSeconds: number): number {
    return 0;
  }

  public applyOfflineIncome(_amount: number, nowUtcMs: number): void {
    this.state.timing.lastActiveTimestampUtcMs = nowUtcMs;
  }

  public getState(): GameState {
    return this.state;
  }

  public toSaveData(nowUtcMs: number): SaveData {
    this.state.timing.lastActiveTimestampUtcMs = nowUtcMs;

    return {
      schemaVersion: 1,
      savedAtUtcMs: nowUtcMs,
      gameState: this.state,
    };
  }

  private spawnCustomers(deltaSeconds: number): void {
    const customersPerSecond = this.state.cafe.customerFlowPerMinute / 60;
    this.state.cafe.spawnRemainder += customersPerSecond * deltaSeconds;

    while (this.state.cafe.spawnRemainder >= 1) {
      this.state.cafe.spawnRemainder -= 1;
      this.spawnCustomer();
    }
  }

  private spawnCustomer(): void {
    const archetype = this.pickArchetype();
    const customer: CustomerState = {
      id: this.createId('customer'),
      archetypeId: archetype.id,
      patienceSec: archetype.patienceSec,
      orderValue: Math.round(this.state.cafe.averageCheck * archetype.valueMultiplier),
      waitedSec: 0,
      status: 'waiting',
    };

    this.state.cafe.activeCustomers.push(customer);

    if (this.state.cafe.customerQueue.customerIds.length >= this.state.cafe.customerQueue.maxSize) {
      this.loseCustomer(customer.id);
      return;
    }

    this.state.cafe.customerQueue.customerIds.push(customer.id);
    this.eventBus.emit({ type: 'customer.spawned', customerId: customer.id, archetypeId: archetype.id });
  }

  private moveWaitingCustomersToOrders(): void {
    while (this.state.cafe.customerQueue.customerIds.length > 0) {
      const customerId = this.state.cafe.customerQueue.customerIds.shift();
      const customer = customerId ? this.findCustomer(customerId) : undefined;
      if (!customer) {
        continue;
      }

      customer.status = 'ordering';
      const order = this.createOrder(customer.id);
      this.state.cafe.activeOrders.push(order);
      this.state.cafe.orderQueue.push(order.id);
      this.eventBus.emit({ type: 'order.created', orderId: order.id, customerId: order.customerId });
    }
  }

  private startBrewingIfPossible(): void {
    if (this.state.cafe.brewingOrderId || this.state.cafe.orderQueue.length === 0) {
      return;
    }

    const orderId = this.state.cafe.orderQueue.shift();
    if (!orderId) {
      return;
    }

    const order = this.findOrder(orderId);
    const customer = order ? this.findCustomer(order.customerId) : undefined;
    if (!order || !customer) {
      return;
    }

    order.status = 'brewing';
    customer.status = 'brewing';
    this.state.cafe.brewingOrderId = order.id;
  }

  private processBrewing(deltaSeconds: number): void {
    const brewingOrderId = this.state.cafe.brewingOrderId;
    if (!brewingOrderId) {
      return;
    }

    const order = this.findOrder(brewingOrderId);
    const customer = order ? this.findCustomer(order.customerId) : undefined;

    if (!order || !customer) {
      this.state.cafe.brewingOrderId = null;
      return;
    }

    order.remainingBrewSec = Math.max(0, order.remainingBrewSec - deltaSeconds);
    if (order.remainingBrewSec > 0) {
      return;
    }

    order.status = 'ready';
    customer.status = 'served';
    this.state.cafe.brewingOrderId = null;
    this.state.cafe.readyOrderIds.push(order.id);
  }

  private serveReadyOrder(): void {
    const orderId = this.state.cafe.readyOrderIds.shift();
    if (!orderId) {
      return;
    }

    const orderIndex = this.state.cafe.activeOrders.findIndex((entry) => entry.id === orderId);
    if (orderIndex === -1) {
      return;
    }

    const order = this.state.cafe.activeOrders[orderIndex];
    const customer = this.findCustomer(order.customerId);

    if (customer) {
      customer.status = 'left';
    }

    order.status = 'served';
    this.state.cafe.activeOrders.splice(orderIndex, 1);
    this.removeCustomer(order.customerId);

    this.state.player.wallet.soft += order.value;
    this.eventBus.emit({ type: 'coffee.sold', amount: order.value });
    this.eventBus.emit({ type: 'economy.moneyEarned', amount: order.value });
    this.eventBus.emit({
      type: 'order.completed',
      orderId: order.id,
      customerId: order.customerId,
      amount: order.value,
    });
  }

  private updatePatience(deltaSeconds: number): void {
    const lostCustomerIds: string[] = [];

    for (const customer of this.state.cafe.activeCustomers) {
      customer.waitedSec += deltaSeconds;
      if (customer.waitedSec >= customer.patienceSec) {
        lostCustomerIds.push(customer.id);
      }
    }

    for (const customerId of lostCustomerIds) {
      this.loseCustomer(customerId);
    }
  }

  private loseCustomer(customerId: string): void {
    const customer = this.findCustomer(customerId);
    if (customer) {
      customer.status = 'left';
    }

    const order = this.state.cafe.activeOrders.find((entry) => entry.customerId === customerId);
    if (order) {
      order.status = 'cancelled';
      this.removeOrder(order.id);
      this.state.cafe.orderQueue = this.state.cafe.orderQueue.filter((id) => id !== order.id);
      this.state.cafe.readyOrderIds = this.state.cafe.readyOrderIds.filter((id) => id !== order.id);

      if (this.state.cafe.brewingOrderId === order.id) {
        this.state.cafe.brewingOrderId = null;
      }
    }

    this.state.cafe.customerQueue.customerIds = this.state.cafe.customerQueue.customerIds.filter((id) => id !== customerId);
    this.removeCustomer(customerId);
    this.eventBus.emit({ type: 'customer.lost', customerId });
  }

  private createOrder(customerId: string): Order {
    const customer = this.findCustomer(customerId);
    return {
      id: this.createId('order'),
      customerId,
      value: customer?.orderValue ?? economyConfig.baseAverageCheck,
      status: 'queued',
      remainingBrewSec: this.getBrewingDurationSec(),
    };
  }

  private getBrewingDurationSec(): number {
    return this.state.cafe.stations[1]?.processingTimeSec ?? 5;
  }

  private pickArchetype(): CustomerArchetype {
    const totalWeight = customersConfig.archetypes.reduce((sum, archetype) => sum + archetype.spawnWeight, 0);
    let roll = Math.random() * totalWeight;

    for (const archetype of customersConfig.archetypes) {
      roll -= archetype.spawnWeight;
      if (roll <= 0) {
        return archetype;
      }
    }

    return customersConfig.archetypes[customersConfig.archetypes.length - 1];
  }

  private findCustomer(customerId: string): CustomerState | undefined {
    return this.state.cafe.activeCustomers.find((entry) => entry.id === customerId);
  }

  private findOrder(orderId: string): Order | undefined {
    return this.state.cafe.activeOrders.find((entry) => entry.id === orderId);
  }

  private removeCustomer(customerId: string): void {
    this.state.cafe.activeCustomers = this.state.cafe.activeCustomers.filter((entry) => entry.id !== customerId);
  }

  private removeOrder(orderId: string): void {
    this.state.cafe.activeOrders = this.state.cafe.activeOrders.filter((entry) => entry.id !== orderId);
  }

  private createId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }
}
