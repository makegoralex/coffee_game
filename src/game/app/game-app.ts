import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { GameState, SaveData } from '@shared/types/state';

export class GameApp {
  private readonly economy = new EconomySystem();

  public constructor(
    private readonly eventBus: EventBus,
    private readonly state: GameState,
  ) {}

  private getSpawnIntervalSec(): number {
    return Math.max(1, 60 / this.state.cafe.customerFlowPerMinute);
  }

  private getBrewDurationSec(): number {
    const levelBonus = 1 + (this.state.cafe.equipmentLevel - 1) * 0.15;
    return Math.max(1.2, this.state.cafe.brewDurationSec / levelBonus);
  }

  public tick(deltaSeconds: number): void {
    this.state.timing.totalSessionSeconds += deltaSeconds;
    this.state.timing.lastActiveTimestampUtcMs = Date.now();

    this.state.cafe.nextVisitorInSec -= deltaSeconds;
    while (this.state.cafe.nextVisitorInSec <= 0) {
      this.state.cafe.visitorQueue += 1;
      this.state.cafe.nextVisitorInSec += this.getSpawnIntervalSec();
      this.eventBus.emit({ type: 'customer.spawned', customerId: crypto.randomUUID() });
    }

    if (!this.state.cafe.hasActiveOrder && this.state.cafe.visitorQueue > 0) {
      this.state.cafe.visitorQueue -= 1;
      this.state.cafe.hasActiveOrder = true;
      this.state.cafe.activeOrderProgressSec = 0;
      this.eventBus.emit({ type: 'customer.leftQueue', customerId: crypto.randomUUID(), reason: 'served' });
    }

    if (this.state.cafe.hasActiveOrder) {
      this.state.cafe.activeOrderProgressSec += deltaSeconds;
      if (this.state.cafe.activeOrderProgressSec >= this.getBrewDurationSec()) {
        this.state.cafe.hasActiveOrder = false;
        this.state.cafe.activeOrderProgressSec = 0;
        this.state.cafe.readyOrders += 1;
      }
    }

  }

  public sellCoffee(): void {
    if (this.state.cafe.readyOrders <= 0) {
      return;
    }

    const amount = this.state.cafe.manualSaleIncome;
    this.state.cafe.readyOrders -= 1;
    this.state.player.wallet.soft += amount;
    this.eventBus.emit({ type: 'coffee.sold', amount });
    this.eventBus.emit({ type: 'economy.moneyEarned', amount });
  }

  public tryBuyEquipmentUpgrade(): boolean {
    const cost = this.economy.computeEquipmentUpgradeCost(this.state);
    if (this.state.player.wallet.soft < cost) {
      return false;
    }

    this.state.player.wallet.soft -= cost;
    this.state.cafe.equipmentLevel += 1;
    this.state.cafe.manualSaleIncome = Math.round(this.state.cafe.manualSaleIncome * 1.2);

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
    const estimatedOrders = Math.floor(clamped / this.getBrewDurationSec());
    return estimatedOrders * this.state.cafe.manualSaleIncome * 0.5;
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
