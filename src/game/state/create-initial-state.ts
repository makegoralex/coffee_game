import type { GameState } from '@shared/types/state';

export function createInitialState(): GameState {
  const now = Date.now();

  return {
    version: 1,
    player: {
      wallet: { soft: 0, premium: 0 },
      adBoostUntilUtcMs: null,
      purchasedProducts: [],
      metaPoints: 0,
    },
    cafe: {
      stations: [],
      activeCustomers: [],
      unlockedZoneIds: ['starter_zone'],
      averageCheck: 12,
      customerFlowPerMinute: 6,
    },
    meta: {
      prestigeLevel: 0,
      permanentIncomeMultiplier: 1,
    },
    progress: {
      tutorialCompleted: false,
      milestoneFlags: {},
    },
    timing: {
      lastActiveTimestampUtcMs: now,
      totalSessionSeconds: 0,
    },
  };
}
