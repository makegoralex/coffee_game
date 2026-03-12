import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { GameState, SaveData } from '@shared/types/state';

export class GameApp {
  private readonly economy = new EconomySystem();

  public constructor(
    private readonly eventBus: EventBus,
    private readonly state: GameState,
  ) {}

  public tick(deltaSeconds: number): void {
    const income = this.economy.computePassiveIncome(this.state, deltaSeconds);
    if (income <= 0) {
      return;
    }

    this.state.player.wallet.soft += income;
    this.state.timing.totalSessionSeconds += deltaSeconds;
    this.state.timing.lastActiveTimestampUtcMs = Date.now();
    this.eventBus.emit({ type: 'economy.moneyEarned', amount: income });
  }

  public sellCoffee(): void {
    const amount = this.state.cafe.manualSaleIncome;
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

  public computeOfflineIncome(nowUtcMs: number, maxOfflineSeconds: number): number {
    const elapsedSeconds = Math.max(0, Math.floor((nowUtcMs - this.state.timing.lastActiveTimestampUtcMs) / 1000));
    const clamped = Math.min(elapsedSeconds, maxOfflineSeconds);
    return this.economy.computePassiveIncome(this.state, clamped);
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
