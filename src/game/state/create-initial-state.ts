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
      stations: createStationState(),
      activeCustomers: [],
      activeOrders: [],
      orderQueue: [],
      brewingOrderId: null,
      readyOrderIds: [],
      customerQueue: {
        customerIds: [],
        maxSize: stationsConfig.stations[0]?.baseQueueSize ?? 0,
      },
      services: createServices(),
      unlockedZoneIds: ['starter_zone'],
      averageCheck: economyConfig.baseAverageCheck,
      customerFlowPerMinute: economyConfig.baseCustomerFlowPerMinute,
      equipmentLevel: 1,
      manualSaleIncome: 5,
      passiveIncomePerSecond: 0,
      equipmentUpgradeBaseCost: 50,
      visitorQueue: 0,
      hasActiveOrder: false,
      activeOrderProgressSec: 0,
      readyOrders: 0,
      nextVisitorInSec: 2,
      brewDurationSec: 4,
      spawnRemainder: 0,
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
