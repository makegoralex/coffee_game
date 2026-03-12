import type { SaveData } from '@shared/types/state';

export interface ISaveBackend {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
}

export class SaveService {
  public constructor(private readonly backend: ISaveBackend) {}

  public async load(): Promise<SaveData | null> {
    return this.backend.load();
  }

  public async save(data: SaveData): Promise<void> {
    await this.backend.save(data);
  }
}
