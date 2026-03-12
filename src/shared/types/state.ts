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

export type RecipeId = 'espresso' | 'americano' | 'latte';

export interface WaitingCustomer {
  id: string;
  recipeId: RecipeId;
  patienceSec: number;
  waitedSec: number;
}

export interface ActiveOrder {
  orderId: string;
  customerId: string;
  recipeId: RecipeId;
  progressSec: number;
  requiredSec: number;
}

export interface ReadyOrder {
  orderId: string;
  customerId: string;
  recipeId: RecipeId;
  price: number;
}

export interface ServiceStats {
  servedCustomers: number;
  lostCustomers: number;
  wrongOrders: number;
}

export interface CafeState {
  stations: StationState[];
  unlockedZoneIds: string[];
  averageCheck: number;
  customerFlowPerMinute: number;
  equipmentLevel: number;
  manualSaleIncome: number;
  passiveIncomePerSecond: number;
  equipmentUpgradeBaseCost: number;
  nextVisitorInSec: number;
  spawnRemainder: number;

  queueCustomers: WaitingCustomer[];
  activeOrder: ActiveOrder | null;
  pickupQueueCustomerIds: string[];
  readyOrders: ReadyOrder[];

  rating: number;
  serviceStats: ServiceStats;
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
