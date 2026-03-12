import { GameApp } from '@game/app/game-app';
import { EventBus } from '@game/events/event-bus';
import { createInitialState } from '@game/state/create-initial-state';

const state = createInitialState();
const bus = new EventBus();

bus.on('economy.moneyEarned', (event) => {
  console.log('[money earned]', event.amount);
});

const app = new GameApp(bus, state);
app.tick(1);
