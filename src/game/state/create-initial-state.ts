import economyConfig from '@data/configs/economy.json';
import stationsConfig from '@data/configs/stations.json';
import type { GameState, ServiceState, StationState } from '@shared/types/state';

function createStationState(): StationState[] {
  return stationsConfig.stations.map((station) => ({
    id: station.id,
    level: 1,
    queueSize: station.baseQueueSize,
    processingTimeSec: station.baseProcessingTimeSec,
    throughputPerMinute: Number((60 / station.baseProcessingTimeSec).toFixed(2)),
  }));
}

function createServices(): ServiceState[] {
  return stationsConfig.stations.map((station) => ({
    stationId: station.id,
    queuedOrderIds: [],
    maxQueueSize: station.baseQueueSize,
    processingTimeSec: station.baseProcessingTimeSec,
    activeTask: null,
  }));
}

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

      activeCustomers: [],
      customerQueue: {
        customerIds: [],
        maxSize: 8,
      },
      activeOrders: [],
      orderQueue: [],
      readyOrderIds: [],
      brewingOrderId: null,
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
