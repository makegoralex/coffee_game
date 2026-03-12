import './styles.css';

import { SaveService } from '@core/save/save-service';
import { LocalStorageSaveBackend } from '@core/save/local-storage-backend';
import { GameApp } from '@game/app/game-app';
import { EventBus } from '@game/events/event-bus';
import { createInitialState } from '@game/state/create-initial-state';
import type { GameState } from '@shared/types/state';

const SAVE_KEY = 'coffee-game-save-v1';
const MAX_OFFLINE_SECONDS = 60 * 60 * 8;

function formatMoney(amount: number): string {
  return `${Math.floor(amount).toLocaleString('ru-RU')} ₽`;
}

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app container');
  }

  const saveService = new SaveService(new LocalStorageSaveBackend(SAVE_KEY));
  const loaded = await saveService.load();

  const state: GameState = loaded?.gameState ?? createInitialState();
  const bus = new EventBus();
  const app = new GameApp(bus, state);

  const now = Date.now();
  const offlineIncome = loaded ? app.computeOfflineIncome(now, MAX_OFFLINE_SECONDS) : 0;
  app.applyOfflineIncome(offlineIncome, now);

  root.innerHTML = `
    <main class="game-shell">
      <header class="game-header card">
        <h1>☕ Coffee Tycoon</h1>
        <p class="subtitle">MVP для Яндекс Игр</p>
      </header>

      <section class="card">
        <div class="label">Баланс кофейни</div>
        <div class="money" id="money">0 ₽</div>
        <div class="hint" id="passive-info">Пассивный доход: 0 ₽/сек</div>
        <div class="hint" id="offline-info"></div>
      </section>

      <section class="card">
        <button class="primary-btn" id="sell-btn">Выдать готовый заказ</button>
      </section>

      <section class="card">
        <div class="row">
          <span class="label">Посетители в очереди</span>
          <span class="label" id="queue-size">0</span>
        </div>
        <div class="row">
          <span class="label">Готовится сейчас</span>
          <span class="label" id="brewing-order">—</span>
        </div>
        <div class="row">
          <span class="label">Готово к выдаче</span>
          <span class="label" id="ready-orders">0</span>
        </div>
      </section>

      <section class="card upgrade">
        <h2>Первое улучшение: Эспрессо-машина</h2>
        <div class="row">
          <span class="label">Уровень</span>
          <span class="label" id="equip-level">1</span>
        </div>
        <div class="row">
          <span class="label">Стоимость</span>
          <span class="label" id="upgrade-cost">0 ₽</span>
        </div>
        <button class="secondary-btn" id="upgrade-btn">Улучшить оборудование</button>
      </section>
    </main>
  `;

  const moneyEl = root.querySelector<HTMLElement>('#money');
  const passiveEl = root.querySelector<HTMLElement>('#passive-info');
  const offlineEl = root.querySelector<HTMLElement>('#offline-info');
  const sellBtn = root.querySelector<HTMLButtonElement>('#sell-btn');
  const queueSizeEl = root.querySelector<HTMLElement>('#queue-size');
  const brewingOrderEl = root.querySelector<HTMLElement>('#brewing-order');
  const readyOrdersEl = root.querySelector<HTMLElement>('#ready-orders');
  const upgradeBtn = root.querySelector<HTMLButtonElement>('#upgrade-btn');
  const upgradeCostEl = root.querySelector<HTMLElement>('#upgrade-cost');
  const equipLevelEl = root.querySelector<HTMLElement>('#equip-level');

  if (!moneyEl || !passiveEl || !offlineEl || !sellBtn || !queueSizeEl || !brewingOrderEl || !readyOrdersEl || !upgradeBtn || !upgradeCostEl || !equipLevelEl) {
    throw new Error('Missing UI elements');
  }

  const ui = {
    moneyEl,
    passiveEl,
    offlineEl,
    sellBtn,
    queueSizeEl,
    brewingOrderEl,
    readyOrdersEl,
    upgradeBtn,
    upgradeCostEl,
    equipLevelEl,
  };

  if (offlineIncome > 0) {
    ui.offlineEl.textContent = `Оффлайн-доход: +${formatMoney(offlineIncome)}`;
  }

  function render(): void {
    const currentState = app.getState();
    const cost = app.getEquipmentUpgradeCost();

    ui.moneyEl.textContent = formatMoney(currentState.player.wallet.soft);
    ui.passiveEl.textContent = `Пассивный доход: ${currentState.cafe.passiveIncomePerSecond.toFixed(1)} ₽/сек`;
    ui.sellBtn.textContent = `Выдать готовый заказ (${currentState.cafe.readyOrderIds.length})`;

    ui.queueSizeEl.textContent = String(currentState.cafe.customerQueue.customerIds.length);
    ui.brewingOrderEl.textContent = currentState.cafe.brewingOrderId ?? '—';
    ui.readyOrdersEl.textContent = String(currentState.cafe.readyOrderIds.length);

    ui.equipLevelEl.textContent = String(currentState.cafe.equipmentLevel);
    ui.upgradeCostEl.textContent = formatMoney(cost);
    ui.upgradeBtn.disabled = currentState.player.wallet.soft < cost;
    ui.sellBtn.disabled = currentState.cafe.readyOrderIds.length === 0;
  }

  ui.sellBtn.addEventListener('click', () => {
    app.sellCoffee();
    render();
  });

  ui.upgradeBtn.addEventListener('click', () => {
    const upgraded = app.tryBuyEquipmentUpgrade();
    if (upgraded) {
      render();
    }
  });

  bus.on('economy.moneyEarned', () => render());
  bus.on('economy.moneySpent', () => render());
  bus.on('upgrade.bought', () => render());

  let lastTickAt = performance.now();

  const tickHandle = window.setInterval(() => {
    const nowPerf = performance.now();
    const deltaSeconds = Math.max(0, (nowPerf - lastTickAt) / 1000);
    lastTickAt = nowPerf;

    app.tick(deltaSeconds);
    render();
  }, 250);

  const saveProgress = async (): Promise<void> => {
    await saveService.save(app.toSaveData(Date.now()));
  };

  const saveHandle = window.setInterval(() => {
    void saveProgress();
  }, 5000);

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      void saveProgress();
    }
  };

  const onPageHide = (): void => {
    void saveProgress();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  window.addEventListener('beforeunload', () => {
    clearInterval(tickHandle);
    clearInterval(saveHandle);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    void saveProgress();
  });

  render();
}

void bootstrap();
