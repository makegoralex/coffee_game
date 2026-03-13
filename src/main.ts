import './styles.css';

import { SaveService } from '@core/save/save-service';
import { LocalStorageSaveBackend } from '@core/save/local-storage-backend';
import { GameApp } from '@game/app/game-app';
import { EventBus } from '@game/events/event-bus';
import { createInitialState } from '@game/state/create-initial-state';
import type { GameState, ReadyOrder, WaitingCustomer } from '@shared/types/state';

const SAVE_KEY = 'coffee-game-save-v1';
const MAX_OFFLINE_SECONDS = 60 * 60 * 8;

let runtimeIdCounter = 0;

function createRuntimeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  runtimeIdCounter += 1;
  return `id_${Date.now()}_${runtimeIdCounter}`;
}

function formatId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeCustomer(raw: Partial<WaitingCustomer>): WaitingCustomer {
  return {
    id: typeof raw.id === 'string' ? raw.id : createRuntimeId(),
    recipeId: raw.recipeId === 'espresso' || raw.recipeId === 'americano' || raw.recipeId === 'latte' ? raw.recipeId : 'americano',
    patienceSec: Math.max(3, toFiniteNumber(raw.patienceSec, 12)),
    waitedSec: Math.max(0, toFiniteNumber(raw.waitedSec, 0)),
    status:
      raw.status === 'waiting' || raw.status === 'ordering' || raw.status === 'brewing' || raw.status === 'served' || raw.status === 'left'
        ? raw.status
        : 'waiting',
  };
}

function sanitizeReadyOrder(raw: Partial<ReadyOrder>): ReadyOrder {
  return {
    orderId: typeof raw.orderId === 'string' ? raw.orderId : createRuntimeId(),
    customerId: typeof raw.customerId === 'string' ? raw.customerId : createRuntimeId(),
    recipeId: raw.recipeId === 'espresso' || raw.recipeId === 'americano' || raw.recipeId === 'latte' ? raw.recipeId : 'americano',
    price: Math.max(1, toFiniteNumber(raw.price, 5)),
  };
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
      nextVisitorInSec: Math.max(0.1, toFiniteNumber(raw.cafe?.nextVisitorInSec, initial.cafe.nextVisitorInSec)),
      spawnRemainder: Math.max(0, toFiniteNumber(raw.cafe?.spawnRemainder, initial.cafe.spawnRemainder)),
      queueCustomers: Array.isArray(raw.cafe?.queueCustomers) ? raw.cafe.queueCustomers.map((customer) => sanitizeCustomer(customer)) : [],
      activeOrder: raw.cafe?.activeOrder
        ? {
            orderId: typeof raw.cafe.activeOrder.orderId === 'string' ? raw.cafe.activeOrder.orderId : createRuntimeId(),
            customerId: typeof raw.cafe.activeOrder.customerId === 'string' ? raw.cafe.activeOrder.customerId : createRuntimeId(),
            recipeId:
              raw.cafe.activeOrder.recipeId === 'espresso' || raw.cafe.activeOrder.recipeId === 'americano' || raw.cafe.activeOrder.recipeId === 'latte'
                ? raw.cafe.activeOrder.recipeId
                : 'americano',
            progressSec: Math.max(0, toFiniteNumber(raw.cafe.activeOrder.progressSec, 0)),
            requiredSec: Math.max(1, toFiniteNumber(raw.cafe.activeOrder.requiredSec, 4)),
          }
        : null,
      pickupQueueCustomerIds: Array.isArray(raw.cafe?.pickupQueueCustomerIds)
        ? raw.cafe.pickupQueueCustomerIds.filter((id): id is string => typeof id === 'string')
        : [],
      readyOrders: Array.isArray(raw.cafe?.readyOrders) ? raw.cafe.readyOrders.map((order) => sanitizeReadyOrder(order)) : [],
      rating: Math.min(100, Math.max(0, toFiniteNumber(raw.cafe?.rating, initial.cafe.rating))),
      serviceStats: {
        servedCustomers: Math.max(0, Math.floor(toFiniteNumber(raw.cafe?.serviceStats?.servedCustomers, 0))),
        lostCustomers: Math.max(0, Math.floor(toFiniteNumber(raw.cafe?.serviceStats?.lostCustomers, 0))),
        wrongOrders: Math.max(0, Math.floor(toFiniteNumber(raw.cafe?.serviceStats?.wrongOrders, 0))),
      },
      activeCustomers: Array.isArray(raw.cafe?.activeCustomers)
        ? raw.cafe.activeCustomers.map((customer) => sanitizeCustomer(customer))
        : [],
      customerQueue:
        raw.cafe?.customerQueue && typeof raw.cafe.customerQueue === 'object'
          ? {
              customerIds: Array.isArray(raw.cafe.customerQueue.customerIds)
                ? raw.cafe.customerQueue.customerIds.filter((id): id is string => typeof id === 'string')
                : [],
              maxSize: Math.max(1, Math.floor(toFiniteNumber(raw.cafe.customerQueue.maxSize, 8))),
            }
          : { customerIds: [], maxSize: 8 },
      activeOrders: Array.isArray(raw.cafe?.activeOrders)
        ? raw.cafe.activeOrders.map((order) => ({
            id: typeof order.id === 'string' ? order.id : createRuntimeId(),
            customerId: typeof order.customerId === 'string' ? order.customerId : createRuntimeId(),
            recipeId: typeof order.recipeId === 'string' ? order.recipeId : 'americano',
            progressSec: Math.max(0, toFiniteNumber(order.progressSec, 0)),
            remainingBrewSec: Math.max(0, toFiniteNumber(order.remainingBrewSec, 0)),
            status: order.status,
            value: Math.max(0, toFiniteNumber(order.value, 0)),
          }))
        : [],
      orderQueue: Array.isArray(raw.cafe?.orderQueue)
        ? raw.cafe.orderQueue.filter((id): id is string => typeof id === 'string')
        : [],
      readyOrderIds: Array.isArray(raw.cafe?.readyOrderIds)
        ? raw.cafe.readyOrderIds.filter((id): id is string => typeof id === 'string')
        : [],
      brewingOrderId: typeof raw.cafe?.brewingOrderId === 'string' ? raw.cafe.brewingOrderId : null,
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
        <p class="subtitle">MVP для Яндекс Игр — очередь, ошибки выдачи, рейтинг</p>
      </header>

      <section class="card">
        <div class="label">Баланс кофейни</div>
        <div class="money" id="money">0 ₽</div>
        <div class="hint" id="rating">Рейтинг: 0</div>
        <div class="hint" id="income-breakdown">Базовый чек: 0 ₽</div>
        <div class="hint" id="offline-info"></div>
      </section>

      <section class="card">
        <h2>Производство</h2>
        <div class="row"><span class="label">Очередь</span><span class="label" id="queue-size">0</span></div>
        <div class="row"><span class="label">Готовится</span><span class="label" id="brewing-status">—</span></div>
        <div class="row"><span class="label">Ждут выдачу</span><span class="label" id="pickup-size">0</span></div>
        <div class="hint" id="next-visitor">Следующий посетитель через 0с</div>
      </section>

      <section class="card">
        <h2>Окно выдачи (схема)</h2>
        <div class="hint">1) Выбери клиента 2) Выбери стакан 3) Нажми «Выдать выбранное».</div>
        <div class="hint" id="serve-status">Клиент: — · Заказ: —</div>
        <div class="label">Клиенты на выдаче</div>
        <div id="pickup-customers" class="ready-orders"></div>
        <div class="label">Готовые стаканы</div>
        <div id="ready-orders" class="ready-orders"></div>
        <button class="primary-btn" id="serve-btn">Выдать выбранное</button>
        <div class="hint">Можно выдать не тот заказ — это понижает рейтинг.</div>
      </section>

      <section class="card">
        <h2>Статистика сервиса</h2>
        <div class="row"><span class="label">Обслужено</span><span class="label" id="served-count">0</span></div>
        <div class="row"><span class="label">Потеряно</span><span class="label" id="lost-count">0</span></div>
        <div class="row"><span class="label">Ошибочных выдач</span><span class="label" id="wrong-count">0</span></div>
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

      <section class="card upgrade">
        <h2>Маркетинг</h2>
        <div class="row">
          <span class="label">Поток клиентов</span>
          <span class="label" id="flow-level">0/мин</span>
        </div>
        <div class="row">
          <span class="label">Стоимость</span>
          <span class="label" id="marketing-cost">0 ₽</span>
        </div>
        <button class="secondary-btn" id="marketing-btn">Запустить рекламу</button>
      </section>

      <section class="card">
        <button class="secondary-btn" id="reset-btn">Сбросить прогресс</button>
      </section>
    </main>
  `;

  const moneyEl = root.querySelector<HTMLElement>('#money');
  const incomeEl = root.querySelector<HTMLElement>('#income-breakdown');
  const ratingEl = root.querySelector<HTMLElement>('#rating');
  const offlineEl = root.querySelector<HTMLElement>('#offline-info');
  const upgradeBtn = root.querySelector<HTMLButtonElement>('#upgrade-btn');
  const resetBtn = root.querySelector<HTMLButtonElement>('#reset-btn');
  const marketingBtn = root.querySelector<HTMLButtonElement>('#marketing-btn');
  const upgradeCostEl = root.querySelector<HTMLElement>('#upgrade-cost');
  const equipLevelEl = root.querySelector<HTMLElement>('#equip-level');
  const marketingCostEl = root.querySelector<HTMLElement>('#marketing-cost');
  const flowLevelEl = root.querySelector<HTMLElement>('#flow-level');
  const queueSizeEl = root.querySelector<HTMLElement>('#queue-size');
  const brewingStatusEl = root.querySelector<HTMLElement>('#brewing-status');
  const pickupSizeEl = root.querySelector<HTMLElement>('#pickup-size');
  const readyOrdersEl = root.querySelector<HTMLElement>('#ready-orders');
  const pickupCustomersEl = root.querySelector<HTMLElement>('#pickup-customers');
  const serveStatusEl = root.querySelector<HTMLElement>('#serve-status');
  const serveBtn = root.querySelector<HTMLButtonElement>('#serve-btn');
  const nextVisitorEl = root.querySelector<HTMLElement>('#next-visitor');
  const servedCountEl = root.querySelector<HTMLElement>('#served-count');
  const lostCountEl = root.querySelector<HTMLElement>('#lost-count');
  const wrongCountEl = root.querySelector<HTMLElement>('#wrong-count');

  if (!moneyEl || !incomeEl || !ratingEl || !offlineEl || !upgradeBtn || !upgradeCostEl || !equipLevelEl || !resetBtn || !marketingBtn || !marketingCostEl || !flowLevelEl || !queueSizeEl || !brewingStatusEl || !pickupSizeEl || !readyOrdersEl || !pickupCustomersEl || !serveStatusEl || !serveBtn || !nextVisitorEl || !servedCountEl || !lostCountEl || !wrongCountEl) {
    throw new Error('Missing UI elements');
  }

  const ui = {
    moneyEl,
    incomeEl,
    ratingEl,
    offlineEl,
    upgradeBtn,
    resetBtn,
    marketingBtn,
    upgradeCostEl,
    equipLevelEl,
    marketingCostEl,
    flowLevelEl,
    queueSizeEl,
    brewingStatusEl,
    pickupSizeEl,
    readyOrdersEl,
    pickupCustomersEl,
    serveStatusEl,
    serveBtn,
    nextVisitorEl,
    servedCountEl,
    lostCountEl,
    wrongCountEl,
  };

  if (offlineIncome > 0) {
    ui.offlineEl.textContent = `Оффлайн-доход: +${formatMoney(offlineIncome)}`;
  }

  let selectedOrderId: string | null = null;
  let selectedCustomerId: string | null = null;
  let isResetting = false;

  const renderServeControls = (): void => {
    const currentState = app.getState();

    if (selectedOrderId && !currentState.cafe.readyOrders.some((order) => order.orderId === selectedOrderId)) {
      selectedOrderId = null;
    }

    if (selectedCustomerId && !currentState.cafe.pickupQueueCustomerIds.includes(selectedCustomerId)) {
      selectedCustomerId = null;
    }

    ui.pickupCustomersEl.innerHTML = currentState.cafe.pickupQueueCustomerIds.length
      ? currentState.cafe.pickupQueueCustomerIds
          .map((customerId, index) => {
            const expectedOrder = currentState.cafe.readyOrders.find((order) => order.customerId === customerId);
            const selectedClass = selectedCustomerId === customerId ? ' secondary-btn' : '';
            const expectedRecipe = expectedOrder ? expectedOrder.recipeId : 'нет';
            return `<button class="primary-btn pickup-customer-btn${selectedClass}" data-customer-id="${customerId}">#${index + 1} Клиент ${formatId(customerId)} · ждёт ${expectedRecipe}</button>`;
          })
          .join('')
      : '<div class="hint">На выдаче пока никого нет.</div>';

    ui.readyOrdersEl.innerHTML = currentState.cafe.readyOrders.length
      ? currentState.cafe.readyOrders
          .map((order) => {
            const selectedClass = selectedOrderId === order.orderId ? ' secondary-btn' : '';
            return `<button class="primary-btn ready-order-btn${selectedClass}" data-order-id="${order.orderId}">${order.recipeId} · ${formatMoney(order.price)} · для ${formatId(order.customerId)}</button>`;
          })
          .join('')
      : '<div class="hint">Пока ничего не готово.</div>';

    ui.pickupCustomersEl.querySelectorAll<HTMLButtonElement>('.pickup-customer-btn').forEach((button) => {
      button.addEventListener('click', () => {
        selectedCustomerId = button.dataset.customerId ?? null;
        render();
      });
    });

    ui.readyOrdersEl.querySelectorAll<HTMLButtonElement>('.ready-order-btn').forEach((button) => {
      button.addEventListener('click', () => {
        selectedOrderId = button.dataset.orderId ?? null;
        render();
      });
    });

    const customerText = selectedCustomerId ? formatId(selectedCustomerId) : '—';
    const orderText = selectedOrderId ? formatId(selectedOrderId) : '—';
    ui.serveStatusEl.textContent = `Клиент: ${customerText} · Заказ: ${orderText}`;
    ui.serveBtn.disabled = !selectedOrderId || !selectedCustomerId;
  };

  function render(): void {
    const currentState = app.getState();
    const cost = app.getEquipmentUpgradeCost();
    const marketingCost = app.getMarketingUpgradeCost();

    ui.moneyEl.textContent = formatMoney(currentState.player.wallet.soft);
    ui.incomeEl.textContent = `Базовый чек: ${formatMoney(currentState.cafe.manualSaleIncome)}`;
    ui.ratingEl.textContent = `Рейтинг: ${currentState.cafe.rating.toFixed(1)} / 100`;

    ui.queueSizeEl.textContent = String(currentState.cafe.queueCustomers.length);
    ui.pickupSizeEl.textContent = String(currentState.cafe.pickupQueueCustomerIds.length);
    ui.nextVisitorEl.textContent = `Следующий посетитель через ${formatSec(currentState.cafe.nextVisitorInSec)}`;
    ui.brewingStatusEl.textContent = currentState.cafe.activeOrder
      ? `${currentState.cafe.activeOrder.recipeId} (${formatSec(currentState.cafe.activeOrder.progressSec)} / ${formatSec(currentState.cafe.activeOrder.requiredSec)})`
      : '—';

    ui.servedCountEl.textContent = String(currentState.cafe.serviceStats.servedCustomers);
    ui.lostCountEl.textContent = String(currentState.cafe.serviceStats.lostCustomers);
    ui.wrongCountEl.textContent = String(currentState.cafe.serviceStats.wrongOrders);

    ui.equipLevelEl.textContent = String(currentState.cafe.equipmentLevel);
    ui.upgradeCostEl.textContent = formatMoney(cost);
    ui.upgradeBtn.disabled = currentState.player.wallet.soft < cost;

    ui.flowLevelEl.textContent = `${currentState.cafe.customerFlowPerMinute.toFixed(0)}/мин`;
    ui.marketingCostEl.textContent = formatMoney(marketingCost);
    ui.marketingBtn.disabled = currentState.player.wallet.soft < marketingCost;

    renderServeControls();
  }

  ui.serveBtn.addEventListener('click', () => {
    if (!selectedOrderId || !selectedCustomerId) {
      return;
    }

    app.serveReadyOrder(selectedOrderId, selectedCustomerId);
    selectedOrderId = null;
    selectedCustomerId = null;
    render();
  });

  ui.upgradeBtn.addEventListener('click', () => {
    app.tryBuyEquipmentUpgrade();
    render();
  });

  ui.marketingBtn.addEventListener('click', () => {
    app.tryBuyMarketingUpgrade();
    render();
  });

  ui.resetBtn.addEventListener('click', async () => {
    isResetting = true;
    clearInterval(tickHandle);
    clearInterval(saveHandle);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);

    localStorage.removeItem(SAVE_KEY);
    await saveService.save({ schemaVersion: 1, savedAtUtcMs: Date.now(), gameState: createInitialState() });
    window.location.reload();
  });

  bus.on('economy.moneyEarned', () => render());
  bus.on('economy.moneySpent', () => render());
  bus.on('upgrade.bought', () => render());
  bus.on('customer.spawned', () => render());
  bus.on('customer.leftQueue', () => render());
  bus.on('customer.lost', () => render());
  bus.on('order.completed', () => render());
  bus.on('order.misserved', () => render());

  let lastTickAt = performance.now();

  const tickHandle = window.setInterval(() => {
    const nowPerf = performance.now();
    const deltaSeconds = Math.max(0, (nowPerf - lastTickAt) / 1000);
    lastTickAt = nowPerf;

    app.tick(deltaSeconds);
    render();
  }, 250);

  const saveProgress = async (): Promise<void> => {
    if (isResetting) {
      return;
    }

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
    if (!isResetting) {
      void saveProgress();
    }
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
