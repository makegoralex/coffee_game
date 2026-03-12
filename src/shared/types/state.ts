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
  status?: 'waiting' | 'ordering' | 'brewing' | 'served' | 'left';
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

// Legacy compatibility aliases to avoid deploy-time type crashes on stale code paths.
export type CustomerState = WaitingCustomer;
export interface CustomerArchetype {
  id: string;
  patienceSec: number;
  orderValue: number;
}
export interface Order {
  id: string;
  customerId: string;
  recipeId: string;
  status?: 'queued' | 'brewing' | 'ready' | 'served' | 'cancelled';
  createdAtUtcMs?: number;
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

  // Legacy optional fields for backward compatibility with older game loop code.
  activeCustomers?: CustomerState[];
  customerQueue?: string[];
  activeOrders?: Array<{ id: string; customerId: string; recipeId: string; progressSec?: number }>;
  orderQueue?: string[];
  readyOrderIds?: string[];
  brewingOrderId?: string | null;
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
