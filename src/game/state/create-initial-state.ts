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
      unlockedZoneIds: ['starter_zone'],
      averageCheck: 12,
      customerFlowPerMinute: 18,
      equipmentLevel: 1,
      manualSaleIncome: 5,
      passiveIncomePerSecond: 0,
      equipmentUpgradeBaseCost: 50,
      nextVisitorInSec: 1.5,
      spawnRemainder: 0,

      queueCustomers: [],
      activeOrder: null,
      pickupQueueCustomerIds: [],
      readyOrders: [],

      rating: 80,
      serviceStats: {
        servedCustomers: 0,
        lostCustomers: 0,
        wrongOrders: 0,
      },
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
