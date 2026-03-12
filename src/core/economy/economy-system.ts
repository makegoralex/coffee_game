import type { GameState } from '@shared/types/state';

export class EconomySystem {
  public computePassiveIncome(state: GameState, deltaSeconds: number): number {
    const adMultiplier =
      state.player.adBoostUntilUtcMs && state.player.adBoostUntilUtcMs > Date.now()
        ? 2
        : 1;

    return (
      state.cafe.passiveIncomePerSecond *
      adMultiplier *
      state.meta.permanentIncomeMultiplier *
      deltaSeconds
    );
  }

  public computeEquipmentUpgradeCost(state: GameState): number {
    const exponent = 1.35;
    return Math.floor(
      state.cafe.equipmentUpgradeBaseCost * Math.pow(exponent, state.cafe.equipmentLevel - 1),
    );
  }

  public canAffordEquipmentUpgrade(state: GameState): boolean {
    return state.player.wallet.soft >= this.computeEquipmentUpgradeCost(state);
  }
}
