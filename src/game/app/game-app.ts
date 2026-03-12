import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { GameState, RecipeId, SaveData, WaitingCustomer } from '@shared/types/state';

const RECIPES: Record<RecipeId, { brewSec: number; priceMultiplier: number }> = {
  espresso: { brewSec: 3.2, priceMultiplier: 0.9 },
  americano: { brewSec: 4.4, priceMultiplier: 1 },
  latte: { brewSec: 6.2, priceMultiplier: 1.25 },
};

const RECIPE_IDS: RecipeId[] = ['espresso', 'americano', 'latte'];

export class GameApp {
  private readonly economy = new EconomySystem();

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
      id: crypto.randomUUID(),
      recipeId: this.pickRecipeId(),
      patienceSec: 10 + Math.random() * 8,
      waitedSec: 0,
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
        const orderId = crypto.randomUUID();
        this.state.cafe.activeOrder = {
          orderId,
          customerId: customer.id,
          recipeId: customer.recipeId,
          progressSec: 0,
          requiredSec: this.getBrewDurationSec(customer.recipeId),
        };
        this.eventBus.emit({ type: 'order.created', orderId, customerId: customer.id, recipeId: customer.recipeId });
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

  public serveReadyOrder(orderId: string): boolean {
    if (this.state.cafe.readyOrders.length <= 0 || this.state.cafe.pickupQueueCustomerIds.length <= 0) {
      return false;
    }

    const orderIndex = this.state.cafe.readyOrders.findIndex((order) => order.orderId === orderId);
    if (orderIndex < 0) {
      return false;
    }

    const order = this.state.cafe.readyOrders[orderIndex];
    const targetCustomerId = this.state.cafe.pickupQueueCustomerIds[0];

    this.state.cafe.readyOrders.splice(orderIndex, 1);
    this.state.cafe.pickupQueueCustomerIds.shift();

    if (order.customerId === targetCustomerId) {
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
      expectedCustomerId: targetCustomerId,
      actualCustomerId: order.customerId,
    });
    this.eventBus.emit({ type: 'customer.lost', customerId: targetCustomerId, reason: 'left' });

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
}
