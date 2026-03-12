import type { GameState } from '@shared/types/state';

export class EconomySystem {
  public computeTickIncome(state: GameState, deltaSeconds: number): number {
    const baseIncomePerSecond =
      (state.cafe.customerFlowPerMinute * state.cafe.averageCheck) / 60;

    const adMultiplier =
      state.player.adBoostUntilUtcMs && state.player.adBoostUntilUtcMs > Date.now()
        ? 2
        : 1;

    return baseIncomePerSecond * adMultiplier * state.meta.permanentIncomeMultiplier * deltaSeconds;
  }
}
