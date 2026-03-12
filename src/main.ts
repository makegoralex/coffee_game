import './styles.css';

import { SaveService } from '@core/save/save-service';
import { LocalStorageSaveBackend } from '@core/save/local-storage-backend';
import { GameApp } from '@game/app/game-app';
import { EventBus } from '@game/events/event-bus';
import { createInitialState } from '@game/state/create-initial-state';
import type { GameState } from '@shared/types/state';

const SAVE_KEY = 'coffee-game-save-v1';
const MAX_OFFLINE_SECONDS = 60 * 60 * 8;

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeState(raw: GameState): GameState {
  const initial = createInitialState();

  return {
    ...initial,
    ...raw,
    player: {
      ...initial.player,
      ...raw.player,
      wallet: {
        soft: Math.max(0, toFiniteNumber(raw.player?.wallet?.soft, initial.player.wallet.soft)),
        premium: Math.max(0, toFiniteNumber(raw.player?.wallet?.premium, initial.player.wallet.premium)),
      },
      metaPoints: Math.max(0, toFiniteNumber(raw.player?.metaPoints, initial.player.metaPoints)),
    },
    cafe: {
      ...initial.cafe,
      ...raw.cafe,
      averageCheck: Math.max(1, toFiniteNumber(raw.cafe?.averageCheck, initial.cafe.averageCheck)),
      customerFlowPerMinute: Math.max(1, toFiniteNumber(raw.cafe?.customerFlowPerMinute, initial.cafe.customerFlowPerMinute)),
      equipmentLevel: Math.max(1, Math.floor(toFiniteNumber(raw.cafe?.equipmentLevel, initial.cafe.equipmentLevel))),
      manualSaleIncome: Math.max(1, toFiniteNumber(raw.cafe?.manualSaleIncome, initial.cafe.manualSaleIncome)),
      passiveIncomePerSecond: Math.max(0, toFiniteNumber(raw.cafe?.passiveIncomePerSecond, initial.cafe.passiveIncomePerSecond)),
      equipmentUpgradeBaseCost: Math.max(10, toFiniteNumber(raw.cafe?.equipmentUpgradeBaseCost, initial.cafe.equipmentUpgradeBaseCost)),
      visitorQueue: Math.max(0, Math.floor(toFiniteNumber(raw.cafe?.visitorQueue, initial.cafe.visitorQueue))),
      hasActiveOrder: Boolean(raw.cafe?.hasActiveOrder),
      activeOrderProgressSec: Math.max(0, toFiniteNumber(raw.cafe?.activeOrderProgressSec, initial.cafe.activeOrderProgressSec)),
      readyOrders: Math.max(0, Math.floor(toFiniteNumber(raw.cafe?.readyOrders, initial.cafe.readyOrders))),
      nextVisitorInSec: Math.max(0.1, toFiniteNumber(raw.cafe?.nextVisitorInSec, initial.cafe.nextVisitorInSec)),
      brewDurationSec: Math.max(1, toFiniteNumber(raw.cafe?.brewDurationSec, initial.cafe.brewDurationSec)),
    },
    meta: {
      ...initial.meta,
      ...raw.meta,
      permanentIncomeMultiplier: Math.max(1, toFiniteNumber(raw.meta?.permanentIncomeMultiplier, initial.meta.permanentIncomeMultiplier)),
    },
    timing: {
      ...initial.timing,
      ...raw.timing,
      lastActiveTimestampUtcMs: Math.max(0, toFiniteNumber(raw.timing?.lastActiveTimestampUtcMs, initial.timing.lastActiveTimestampUtcMs)),
      totalSessionSeconds: Math.max(0, toFiniteNumber(raw.timing?.totalSessionSeconds, initial.timing.totalSessionSeconds)),
    },
  };
}

function formatMoney(amount: number): string {
  return `${Math.floor(amount).toLocaleString('ru-RU')} ₽`;
}

function formatSec(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}с`;
}

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app container');
  }

  const saveService = new SaveService(new LocalStorageSaveBackend(SAVE_KEY));
  const loaded = await saveService.load();

  const baseState = loaded?.gameState ? sanitizeState(loaded.gameState) : createInitialState();
  const bus = new EventBus();
  const app = new GameApp(bus, baseState);

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
        <div class="hint" id="income-breakdown">Доход за заказ: 0 ₽</div>
        <div class="hint" id="offline-info"></div>
      </section>

      <section class="card">
        <button class="primary-btn" id="sell-btn">Выдать готовый заказ</button>
        <div class="hint">Кнопка активна, когда есть готовые заказы.</div>
      </section>

      <section class="card">
        <h2>Поток посетителей</h2>
        <div class="row"><span class="label">В очереди</span><span class="label" id="queue-size">0</span></div>
        <div class="row"><span class="label">Готовится сейчас</span><span class="label" id="brewing-status">—</span></div>
        <div class="row"><span class="label">Готово к выдаче</span><span class="label" id="ready-count">0</span></div>
        <div class="hint" id="next-visitor">Следующий посетитель через 0с</div>
      </section>

      <section class="card upgrade">
        <h2>Эспрессо-машина</h2>
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

      <section class="card">
        <button class="secondary-btn" id="reset-btn">Сбросить прогресс</button>
      </section>
    </main>
  `;

  const moneyEl = root.querySelector<HTMLElement>('#money');
  const incomeEl = root.querySelector<HTMLElement>('#income-breakdown');
  const offlineEl = root.querySelector<HTMLElement>('#offline-info');
  const sellBtn = root.querySelector<HTMLButtonElement>('#sell-btn');
  const upgradeBtn = root.querySelector<HTMLButtonElement>('#upgrade-btn');
  const resetBtn = root.querySelector<HTMLButtonElement>('#reset-btn');
  const upgradeCostEl = root.querySelector<HTMLElement>('#upgrade-cost');
  const equipLevelEl = root.querySelector<HTMLElement>('#equip-level');
  const queueSizeEl = root.querySelector<HTMLElement>('#queue-size');
  const brewingStatusEl = root.querySelector<HTMLElement>('#brewing-status');
  const readyCountEl = root.querySelector<HTMLElement>('#ready-count');
  const nextVisitorEl = root.querySelector<HTMLElement>('#next-visitor');

  if (!moneyEl || !incomeEl || !offlineEl || !sellBtn || !upgradeBtn || !upgradeCostEl || !equipLevelEl || !resetBtn || !queueSizeEl || !brewingStatusEl || !readyCountEl || !nextVisitorEl) {
    throw new Error('Missing UI elements');
  }

  const ui = { moneyEl, incomeEl, offlineEl, sellBtn, upgradeBtn, resetBtn, upgradeCostEl, equipLevelEl, queueSizeEl, brewingStatusEl, readyCountEl, nextVisitorEl };

  if (offlineIncome > 0) {
    ui.offlineEl.textContent = `Оффлайн-доход: +${formatMoney(offlineIncome)}`;
  }

  function render(): void {
    const currentState = app.getState();
    const cost = app.getEquipmentUpgradeCost();

    ui.moneyEl.textContent = formatMoney(currentState.player.wallet.soft);
    ui.incomeEl.textContent = `Доход за заказ: ${formatMoney(currentState.cafe.manualSaleIncome)}`;

    ui.queueSizeEl.textContent = String(currentState.cafe.visitorQueue);
    ui.readyCountEl.textContent = String(currentState.cafe.readyOrders);
    ui.nextVisitorEl.textContent = `Следующий посетитель через ${formatSec(currentState.cafe.nextVisitorInSec)}`;
    ui.brewingStatusEl.textContent = currentState.cafe.hasActiveOrder
      ? `в процессе (${formatSec(currentState.cafe.activeOrderProgressSec)})`
      : '—';

    ui.sellBtn.textContent = `Выдать готовый заказ (+${formatMoney(currentState.cafe.manualSaleIncome)})`;
    ui.sellBtn.disabled = currentState.cafe.readyOrders <= 0;

    ui.equipLevelEl.textContent = String(currentState.cafe.equipmentLevel);
    ui.upgradeCostEl.textContent = formatMoney(cost);
    ui.upgradeBtn.disabled = currentState.player.wallet.soft < cost;
  }

  ui.sellBtn.addEventListener('click', () => {
    app.sellCoffee();
    render();
  });

  ui.upgradeBtn.addEventListener('click', () => {
    app.tryBuyEquipmentUpgrade();
    render();
  });

  ui.resetBtn.addEventListener('click', async () => {
    localStorage.removeItem(SAVE_KEY);
    await saveService.save({ schemaVersion: 1, savedAtUtcMs: Date.now(), gameState: createInitialState() });
    window.location.reload();
  });

  bus.on('economy.moneyEarned', () => render());
  bus.on('economy.moneySpent', () => render());
  bus.on('upgrade.bought', () => render());
  bus.on('customer.spawned', () => render());
  bus.on('customer.leftQueue', () => render());

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
