import customersConfig from '@data/configs/customers.json';
import economyConfig from '@data/configs/economy.json';
import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { CustomerState, GameState, Order, SaveData, ServiceState, WorkerTask } from '@shared/types/state';

const STATION_PIPELINE = ['cashier', 'espresso_machine', 'pickup'] as const;

type StationId = (typeof STATION_PIPELINE)[number];

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
    this.feedCashierQueueFromVisitors();
    this.processServices(deltaSeconds);
  }

  public sellCoffee(): void {
    this.processServices(0);
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
    };

    this.state.cafe.activeCustomers.push(customer);

    if (this.state.cafe.customerQueue.customerIds.length >= this.state.cafe.customerQueue.maxSize) {
      this.loseCustomer(customer.id);
      return;
    }

    this.state.cafe.customerQueue.customerIds.push(customer.id);
    this.eventBus.emit({ type: 'customer.spawned', customerId: customer.id, archetypeId: archetype.id });
  }

  private feedCashierQueueFromVisitors(): void {
    const cashierService = this.getService('cashier');
    if (!cashierService) {
      return;
    }

    while (
      this.state.cafe.customerQueue.customerIds.length > 0
      && cashierService.queuedOrderIds.length < cashierService.maxQueueSize
    ) {
      const customerId = this.state.cafe.customerQueue.customerIds.shift();
      if (!customerId || !this.findCustomer(customerId)) {
        continue;
      }

      const order = this.createOrder(customerId);
      this.state.cafe.activeOrders.push(order);
      cashierService.queuedOrderIds.push(order.id);
      this.eventBus.emit({ type: 'order.created', orderId: order.id, customerId: order.customerId });
    }
  }

  private processServices(deltaSeconds: number): void {
    for (const stationId of STATION_PIPELINE) {
      const service = this.getService(stationId);
      if (!service) {
        continue;
      }

      if (!service.activeTask && service.queuedOrderIds.length > 0) {
        const nextOrderId = service.queuedOrderIds.shift();
        if (nextOrderId) {
          const order = this.findOrder(nextOrderId);
          if (order && this.findCustomer(order.customerId)) {
            service.activeTask = this.createTask(order, service);
          }
        }
      }

      if (!service.activeTask) {
        continue;
      }

      service.activeTask.remainingSec = Math.max(0, service.activeTask.remainingSec - deltaSeconds);
      if (service.activeTask.remainingSec > 0) {
        continue;
      }

      this.completeTask(service);
    }
  }

  private completeTask(service: ServiceState): void {
    const task = service.activeTask;
    if (!task) {
      return;
    }

    const order = this.findOrder(task.orderId);
    if (!order || !this.findCustomer(order.customerId)) {
      service.activeTask = null;
      return;
    }

    const nextStation = this.getNextStation(order.currentStationId as StationId);
    if (!nextStation) {
      this.completeOrder(order.id);
      service.activeTask = null;
      return;
    }

    const nextService = this.getService(nextStation);
    if (!nextService) {
      service.activeTask = null;
      return;
    }

    if (nextService.queuedOrderIds.length >= nextService.maxQueueSize) {
      return;
    }

    order.currentStationId = nextStation;
    nextService.queuedOrderIds.push(order.id);
    service.activeTask = null;
  }

  private completeOrder(orderId: string): void {
    const orderIndex = this.state.cafe.activeOrders.findIndex((entry) => entry.id === orderId);
    if (orderIndex === -1) {
      return;
    }

    const order = this.state.cafe.activeOrders[orderIndex];
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
    this.removeCustomer(customerId);

    const order = this.state.cafe.activeOrders.find((entry) => entry.customerId === customerId);
    if (order) {
      this.removeOrder(order.id);
    }

    this.state.cafe.customerQueue.customerIds = this.state.cafe.customerQueue.customerIds.filter((id) => id !== customerId);

    for (const service of this.state.cafe.services) {
      service.queuedOrderIds = service.queuedOrderIds.filter((orderId) => {
        const queuedOrder = this.findOrder(orderId);
        return queuedOrder ? queuedOrder.customerId !== customerId : false;
      });

      if (service.activeTask && service.activeTask.customerId === customerId) {
        service.activeTask = null;
      }
    }

    this.eventBus.emit({ type: 'customer.lost', customerId });
  }

  private createOrder(customerId: string): Order {
    const customer = this.findCustomer(customerId);
    return {
      id: this.createId('order'),
      customerId,
      value: customer?.orderValue ?? economyConfig.baseAverageCheck,
      currentStationId: 'cashier',
    };
  }

  private createTask(order: Order, service: ServiceState): WorkerTask {
    return {
      id: this.createId('task'),
      orderId: order.id,
      customerId: order.customerId,
      stationId: service.stationId,
      remainingSec: service.processingTimeSec,
      totalSec: service.processingTimeSec,
    };
  }

  private getService(stationId: StationId): ServiceState | undefined {
    return this.state.cafe.services.find((service) => service.stationId === stationId);
  }

  private getNextStation(stationId: StationId): StationId | null {
    const index = STATION_PIPELINE.indexOf(stationId);
    if (index === -1 || index >= STATION_PIPELINE.length - 1) {
      return null;
    }

    return STATION_PIPELINE[index + 1];
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
