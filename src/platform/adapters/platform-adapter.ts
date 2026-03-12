export interface RewardedResult {
  completed: boolean;
  rewardId?: string;
}

export interface PurchaseResult {
  success: boolean;
  productId: string;
}

export interface IPlatformAdapter {
  init(): Promise<void>;
  showRewardedAd(rewardId: string): Promise<RewardedResult>;
  showInterstitial(): Promise<void>;
  purchaseProduct(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<string[]>;
  trackEvent(eventName: string, params?: Record<string, unknown>): void;
}
