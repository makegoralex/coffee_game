import customersConfig from '@data/configs/customers.json';
import economyConfig from '@data/configs/economy.json';
import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { GameState, RecipeId, SaveData, WaitingCustomer } from '@shared/types/state';

const RECIPES: Record<RecipeId, { brewSec: number; priceMultiplier: number }> = {
  espresso: { brewSec: 3.2, priceMultiplier: 0.9 },
  americano: { brewSec: 4.4, priceMultiplier: 1 },
  latte: { brewSec: 6.2, priceMultiplier: 1.25 },
};


const RECIPE_IDS: RecipeId[] = ['espresso', 'americano', 'latte'];

let runtimeIdCounter = 0;

function createRuntimeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  runtimeIdCounter += 1;
  return `id_${Date.now()}_${runtimeIdCounter}`;
}

export class GameApp {
  private readonly economy = new EconomySystem();
  private idCounter = 0;

  public constructor(
    private readonly eventBus: EventBus,
    private readonly state: GameState,
  ) {}

  private getSpawnIntervalSec(): number {
    const ratingMultiplier = 0.8 + this.state.cafe.rating / 200;
    return Math.max(0.75, 60 / (this.state.cafe.customerFlowPerMinute * ratingMultiplier));
  }

  private getBrewDurationSec(recipeId: RecipeId): number {
    const levelBonus = 1 + (this.state.cafe.equipmentLevel - 1) * 0.12;
    return Math.max(1, RECIPES[recipeId].brewSec / levelBonus);
  }

  private pickRecipeId(): RecipeId {
    const index = Math.floor(Math.random() * RECIPE_IDS.length);
    return RECIPE_IDS[index];
  }

  private createCustomer(): WaitingCustomer {
    return {
      id: createRuntimeId(),
      recipeId: this.pickRecipeId(),
      patienceSec: 10 + Math.random() * 8,
      waitedSec: 0,
      status: 'waiting',
    };
  }

  private clampRating(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  public tick(deltaSeconds: number): void {
    this.state.timing.totalSessionSeconds += deltaSeconds;
    this.state.timing.lastActiveTimestampUtcMs = Date.now();

    this.state.cafe.nextVisitorInSec -= deltaSeconds;
    while (this.state.cafe.nextVisitorInSec <= 0) {
      const customer = this.createCustomer();
      this.state.cafe.queueCustomers.push(customer);
      this.state.cafe.nextVisitorInSec += this.getSpawnIntervalSec();
      this.eventBus.emit({ type: 'customer.spawned', customerId: customer.id });
    }

    const stillWaiting: WaitingCustomer[] = [];
    for (const customer of this.state.cafe.queueCustomers) {
      customer.waitedSec += deltaSeconds;
      if (customer.waitedSec > customer.patienceSec) {
        this.state.cafe.serviceStats.lostCustomers += 1;
        this.state.cafe.rating = this.clampRating(this.state.cafe.rating - 3);
        this.eventBus.emit({ type: 'customer.lost', customerId: customer.id, reason: 'timeout' });
      } else {
        stillWaiting.push(customer);
      }
    }
    this.state.cafe.queueCustomers = stillWaiting;

    if (!this.state.cafe.activeOrder && this.state.cafe.queueCustomers.length > 0) {
      const customer = this.state.cafe.queueCustomers.shift();
      if (customer) {
        const orderId = createRuntimeId();
        const recipeId = customer.recipeId ?? 'americano';
        this.state.cafe.activeOrder = {
          orderId,
          customerId: customer.id,
          recipeId,
          progressSec: 0,
          requiredSec: this.getBrewDurationSec(recipeId),
        };
        this.eventBus.emit({ type: 'order.created', orderId, customerId: customer.id, recipeId });
        this.eventBus.emit({ type: 'customer.leftQueue', customerId: customer.id, reason: 'served' });
      }
    }

    if (this.state.cafe.activeOrder) {
      this.state.cafe.activeOrder.progressSec += deltaSeconds;
      if (this.state.cafe.activeOrder.progressSec >= this.state.cafe.activeOrder.requiredSec) {
        const completedOrder = this.state.cafe.activeOrder;
        this.state.cafe.activeOrder = null;

        const baseAmount = this.state.cafe.manualSaleIncome;
        const amount = Math.round(baseAmount * RECIPES[completedOrder.recipeId].priceMultiplier);

        this.state.cafe.readyOrders.push({
          orderId: completedOrder.orderId,
          customerId: completedOrder.customerId,
          recipeId: completedOrder.recipeId,
          price: amount,
        });
        this.state.cafe.pickupQueueCustomerIds.push(completedOrder.customerId);

        this.eventBus.emit({ type: 'order.completed', orderId: completedOrder.orderId, amount });
      }
    }
  }

  public serveReadyOrder(orderId: string, targetCustomerId?: string): boolean {
    if (this.state.cafe.readyOrders.length <= 0 || this.state.cafe.pickupQueueCustomerIds.length <= 0) {
      return false;
    }

    const orderIndex = this.state.cafe.readyOrders.findIndex((order) => order.orderId === orderId);
    if (orderIndex < 0) {
      return false;
    }

    const expectedCustomerId = targetCustomerId ?? this.state.cafe.pickupQueueCustomerIds[0];
    const pickupIndex = this.state.cafe.pickupQueueCustomerIds.findIndex((id) => id === expectedCustomerId);
    if (pickupIndex < 0) {
      return false;
    }

    const order = this.state.cafe.readyOrders[orderIndex];

    this.state.cafe.readyOrders.splice(orderIndex, 1);
    this.state.cafe.pickupQueueCustomerIds.splice(pickupIndex, 1);

    if (order.customerId === expectedCustomerId) {
      this.state.player.wallet.soft += order.price;
      this.state.cafe.serviceStats.servedCustomers += 1;
      this.state.cafe.rating = this.clampRating(this.state.cafe.rating + 0.7);
      this.eventBus.emit({ type: 'coffee.sold', amount: order.price });
      this.eventBus.emit({ type: 'economy.moneyEarned', amount: order.price });
      return true;
    }

    this.state.cafe.serviceStats.wrongOrders += 1;
    this.state.cafe.serviceStats.lostCustomers += 1;
    this.state.cafe.rating = this.clampRating(this.state.cafe.rating - 8);
    this.eventBus.emit({
      type: 'order.misserved',
      orderId: order.orderId,
      expectedCustomerId,
      actualCustomerId: order.customerId,
    });
    this.eventBus.emit({ type: 'customer.lost', customerId: expectedCustomerId, reason: 'left' });

    return false;
  }

  public tryBuyEquipmentUpgrade(): boolean {
    const cost = this.economy.computeEquipmentUpgradeCost(this.state);
    if (this.state.player.wallet.soft < cost) {
      return false;
    }

    this.state.player.wallet.soft -= cost;
    this.state.cafe.equipmentLevel += 1;
    this.state.cafe.manualSaleIncome = Math.round(this.state.cafe.manualSaleIncome * 1.15);

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

  private getMarketingUpgradeLevel(): number {
    const baseFlow = 18;
    const step = 2;
    const normalized = Math.max(0, this.state.cafe.customerFlowPerMinute - baseFlow);
    return Math.floor(normalized / step) + 1;
  }

  public getMarketingUpgradeCost(): number {
    const exponent = 1.32;
    const baseCost = Math.max(20, Math.floor(this.state.cafe.equipmentUpgradeBaseCost * 0.8));
    return Math.floor(baseCost * Math.pow(exponent, this.getMarketingUpgradeLevel() - 1));
  }

  public tryBuyMarketingUpgrade(): boolean {
    const cost = this.getMarketingUpgradeCost();
    if (this.state.player.wallet.soft < cost) {
      return false;
    }

    this.state.player.wallet.soft -= cost;
    this.state.cafe.customerFlowPerMinute = Math.min(120, this.state.cafe.customerFlowPerMinute + 2);
    this.state.cafe.rating = this.clampRating(this.state.cafe.rating + 0.5);

    this.eventBus.emit({ type: 'economy.moneySpent', amount: cost });
    this.eventBus.emit({
      type: 'upgrade.bought',
      upgradeId: 'marketing_campaign_level',
      newLevel: this.getMarketingUpgradeLevel(),
    });

    return true;
  }

  public computeOfflineIncome(nowUtcMs: number, maxOfflineSeconds: number): number {
    const elapsedSeconds = Math.max(0, Math.floor((nowUtcMs - this.state.timing.lastActiveTimestampUtcMs) / 1000));
    const clamped = Math.min(elapsedSeconds, maxOfflineSeconds);
    const estimatedOrders = Math.floor(clamped / this.getBrewDurationSec('americano'));
    return estimatedOrders * this.state.cafe.manualSaleIncome * 0.35;
  }

  public applyOfflineIncome(amount: number, nowUtcMs: number): void {
    if (amount > 0) {
      this.state.player.wallet.soft += amount;
      this.eventBus.emit({ type: 'economy.moneyEarned', amount });
    }

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
    this.state.cafe.brewingOrderId = null;
    this.state.cafe.readyOrderIds.push(order.id);
  }

  private serveReadyOrderLegacy(): void {
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
      customer.status = 'served';
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
      if (customer.status === 'served' || customer.status === 'left') {
        continue;
      }

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
