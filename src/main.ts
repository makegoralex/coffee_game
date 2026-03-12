import { LocalStorageSaveBackend } from '@core/save/local-storage-backend';
import { SaveService } from '@core/save/save-service';
import { GameApp } from '@game/app/game-app';
import { EventBus } from '@game/events/event-bus';
import { createInitialState } from '@game/state/create-initial-state';
import type { GameState } from '@shared/types/state';
import './styles.css';

const SAVE_KEY = 'coffee_game_save_v1';
const MAX_OFFLINE_SECONDS = 60 * 60 * 4;
const FIXED_STEP_SECONDS = 1 / 10;
const MAX_FRAME_SECONDS = 0.25;

function formatMoney(value: number): string {
  return `${Math.floor(value).toLocaleString('ru-RU')} ₽`;
}

function hydrateState(source: unknown): GameState {
  const fallback = createInitialState();
  if (!source || typeof source !== 'object') {
    return fallback;
  }

  const data = source as Partial<GameState>;
  return {
    ...fallback,
    ...data,
    player: { ...fallback.player, ...data.player },
    cafe: { ...fallback.cafe, ...data.cafe },
    meta: { ...fallback.meta, ...data.meta },
    progress: { ...fallback.progress, ...data.progress },
    timing: { ...fallback.timing, ...data.timing },
  };
}

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app root element');
  }

  const saveService = new SaveService(new LocalStorageSaveBackend(SAVE_KEY));
  const loaded = await saveService.load();
  const state = loaded ? hydrateState(loaded.gameState) : createInitialState();

  const bus = new EventBus();
  const app = new GameApp(bus, state);

  const now = Date.now();
  const offlineIncome = app.computeOfflineIncome(now, MAX_OFFLINE_SECONDS);
  app.applyOfflineIncome(offlineIncome, now);

  root.innerHTML = `
    <main class="game-shell">
      <header class="game-header">
        <h1>☕ Моя кофейня</h1>
        <p class="subtitle">Idle / Tycoon MVP</p>
      </header>

      <section class="money-panel card">
        <div class="label">Баланс</div>
        <div class="money" id="moneyValue">0 ₽</div>
        <div class="hint" id="incomeHint">Пассивный доход: 0 ₽/сек</div>
        <div class="hint" id="offlineHint"></div>
      </section>

      <section class="actions card">
        <button id="sellCoffeeBtn" class="primary-btn">Продать кофе</button>
        <div class="hint" id="manualIncomeHint"></div>
      </section>

      <section class="upgrade card">
        <h2>Оборудование</h2>
        <div class="row"><span>Уровень эспрессо-машины</span><strong id="equipmentLevel">1</strong></div>
        <div class="row"><span>Стоимость улучшения</span><strong id="upgradeCost">0 ₽</strong></div>
        <button id="upgradeBtn" class="secondary-btn">Улучшить оборудование</button>
      </section>
    </main>
  `;

  const moneyValue = root.querySelector<HTMLElement>('#moneyValue');
  const incomeHint = root.querySelector<HTMLElement>('#incomeHint');
  const manualIncomeHint = root.querySelector<HTMLElement>('#manualIncomeHint');
  const equipmentLevel = root.querySelector<HTMLElement>('#equipmentLevel');
  const upgradeCost = root.querySelector<HTMLElement>('#upgradeCost');
  const upgradeBtn = root.querySelector<HTMLButtonElement>('#upgradeBtn');
  const sellCoffeeBtn = root.querySelector<HTMLButtonElement>('#sellCoffeeBtn');
  const offlineHint = root.querySelector<HTMLElement>('#offlineHint');

  if (!moneyValue || !incomeHint || !manualIncomeHint || !equipmentLevel || !upgradeCost || !upgradeBtn || !sellCoffeeBtn || !offlineHint) {
    throw new Error('UI binding failed');
  }

  if (offlineIncome > 0) {
    offlineHint.textContent = `Оффлайн доход: +${formatMoney(offlineIncome)}`;
  }

  const render = (): void => {
    const current = app.getState();
    moneyValue.textContent = formatMoney(current.player.wallet.soft);
    incomeHint.textContent = `Пассивный доход: ${formatMoney(current.cafe.passiveIncomePerSecond)}/сек`;
    manualIncomeHint.textContent = `Ручная продажа: +${formatMoney(current.cafe.manualSaleIncome)}`;
    equipmentLevel.textContent = String(current.cafe.equipmentLevel);

    const cost = app.getEquipmentUpgradeCost();
    upgradeCost.textContent = formatMoney(cost);
    upgradeBtn.disabled = current.player.wallet.soft < cost;
  };

  sellCoffeeBtn.addEventListener('click', () => {
    app.sellCoffee();
    render();
  });

  upgradeBtn.addEventListener('click', () => {
    app.tryBuyEquipmentUpgrade();
    render();
  });

  bus.on('economy.moneyEarned', () => {
    render();
  });

  let lastTick = performance.now();
  let accumulator = 0;
  const loop = (timestamp: number): void => {
    const deltaSec = Math.min((timestamp - lastTick) / 1000, MAX_FRAME_SECONDS);
    lastTick = timestamp;

    accumulator += deltaSec;
    while (accumulator >= FIXED_STEP_SECONDS) {
      app.tick(FIXED_STEP_SECONDS);
      accumulator -= FIXED_STEP_SECONDS;
    }

    requestAnimationFrame(loop);
  };

  render();
  requestAnimationFrame(loop);

  const persist = async (): Promise<void> => {
    await saveService.save(app.toSaveData(Date.now()));
  };

  const autosaveIntervalId = window.setInterval(() => {
    void persist();
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      void persist();
    }
  });

  window.addEventListener('beforeunload', () => {
    void persist();
  });

  window.addEventListener('pagehide', () => {
    void persist();
    window.clearInterval(autosaveIntervalId);
  });
}

void bootstrap();
