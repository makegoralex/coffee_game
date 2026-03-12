import type { IPlatformAdapter } from '@platform/adapters/platform-adapter';

export class MonetizationService {
  public constructor(private readonly adapter: IPlatformAdapter) {}

  public async requestRewarded(rewardId: string): Promise<boolean> {
    const result = await this.adapter.showRewardedAd(rewardId);
    return result.completed;
  }
}
