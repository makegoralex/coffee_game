export interface CurrencyWallet {
  soft: number;
  premium: number;
}

export interface PlayerState {
  wallet: CurrencyWallet;
  adBoostUntilUtcMs: number | null;
  purchasedProducts: string[];
  metaPoints: number;
}

export interface StationState {
  id: string;
  level: number;
  queueSize: number;
  processingTimeSec: number;
  throughputPerMinute: number;
}

export interface CustomerState {
  id: string;
  archetypeId: string;
  patienceSec: number;
  orderValue: number;
  waitedSec: number;
  status: CustomerStatus;
}

export type CustomerStatus = 'waiting' | 'ordering' | 'brewing' | 'served' | 'left';

export type OrderStatus = 'queued' | 'brewing' | 'ready' | 'served' | 'cancelled';

export interface Order {
  id: string;
  customerId: string;
  value: number;
  status: OrderStatus;
  remainingBrewSec: number;
}

export interface WorkerTask {
  id: string;
  orderId: string;
  customerId: string;
  stationId: string;
  remainingSec: number;
  totalSec: number;
}

export interface QueueState {
  customerIds: string[];
  maxSize: number;
}

export interface ServiceState {
  stationId: string;
  queuedOrderIds: string[];
  maxQueueSize: number;
  processingTimeSec: number;
  activeTask: WorkerTask | null;
}

export interface Order {
  id: string;
  customerId: string;
  value: number;
  currentStationId: string;
}

export interface WorkerTask {
  id: string;
  orderId: string;
  customerId: string;
  stationId: string;
  remainingSec: number;
  totalSec: number;
}

export interface QueueState {
  customerIds: string[];
  maxSize: number;
}

export interface ServiceState {
  stationId: string;
  queuedOrderIds: string[];
  maxQueueSize: number;
  processingTimeSec: number;
  activeTask: WorkerTask | null;
}

export interface CafeState {
  stations: StationState[];
  activeCustomers: CustomerState[];
  activeOrders: Order[];
  customerQueue: QueueState;
  services: ServiceState[];
  unlockedZoneIds: string[];
  averageCheck: number;
  customerFlowPerMinute: number;
  equipmentLevel: number;
  manualSaleIncome: number;
  passiveIncomePerSecond: number;
  equipmentUpgradeBaseCost: number;
  spawnRemainder: number;
}

export interface MetaProgressState {
  prestigeLevel: number;
  permanentIncomeMultiplier: number;
}

export interface ProgressState {
  tutorialCompleted: boolean;
  milestoneFlags: Record<string, boolean>;
}

export interface TimingState {
  lastActiveTimestampUtcMs: number;
  totalSessionSeconds: number;
}

export interface GameState {
  version: number;
  player: PlayerState;
  cafe: CafeState;
  meta: MetaProgressState;
  progress: ProgressState;
  timing: TimingState;
}

export interface SaveData {
  schemaVersion: number;
  savedAtUtcMs: number;
  gameState: GameState;
}
