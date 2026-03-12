import { EconomySystem } from '@core/economy/economy-system';
import { EventBus } from '@game/events/event-bus';
import type { GameState } from '@shared/types/state';

export class GameApp {
  private readonly economy = new EconomySystem();

  public constructor(
    private readonly eventBus: EventBus,
    private readonly state: GameState,
  ) {}

  public tick(deltaSeconds: number): void {
    const income = this.economy.computeTickIncome(this.state, deltaSeconds);
    if (income <= 0) {
      return;
    }

    this.state.player.wallet.soft += income;
    this.eventBus.emit({ type: 'economy.moneyEarned', amount: income });
  }
}
