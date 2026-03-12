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
}

export interface CafeState {
  stations: StationState[];
  activeCustomers: CustomerState[];
  unlockedZoneIds: string[];
  averageCheck: number;
  customerFlowPerMinute: number;
  equipmentLevel: number;
  manualSaleIncome: number;
  passiveIncomePerSecond: number;
  equipmentUpgradeBaseCost: number;
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
