export type GameEvent =
  | { type: 'economy.moneyEarned'; amount: number }
  | { type: 'economy.moneySpent'; amount: number }
  | { type: 'coffee.sold'; amount: number }
  | { type: 'upgrade.bought'; upgradeId: string; newLevel: number }
  | { type: 'monetization.rewardGranted'; rewardId: string };

type Handler<T extends GameEvent> = (event: T) => void;

export class EventBus {
  private handlers: { [K in GameEvent['type']]?: Array<Handler<Extract<GameEvent, { type: K }>>> } = {};

  public on<K extends GameEvent['type']>(
    type: K,
    handler: Handler<Extract<GameEvent, { type: K }>>,
  ): void {
    const list = (this.handlers[type] ??= []);
    list.push(handler as never);
  }

  public emit<T extends GameEvent>(event: T): void {
    const list = this.handlers[event.type] ?? [];
    for (const handler of list) {
      handler(event as never);
    }
  }
}
