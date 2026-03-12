import type { SaveData } from '@shared/types/state';
import type { ISaveBackend } from './save-service';

export class LocalStorageSaveBackend implements ISaveBackend {
  public constructor(private readonly key: string) {}

  public async load(): Promise<SaveData | null> {
    const raw = localStorage.getItem(this.key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SaveData;
    } catch {
      return null;
    }
  }

  public async save(data: SaveData): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
}
