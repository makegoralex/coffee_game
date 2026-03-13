import './styles.css';

type Screen = 'base' | 'map' | 'fishing';
type ItemType = 'rod' | 'reel' | 'line' | 'hook' | 'bait';
type FishingPhase = 'idle' | 'waiting' | 'bite' | 'hooked' | 'landed' | 'escaped' | 'broken';
type PullAction = 'rod' | 'reel' | null;

interface Rod {
  id: number;
  x: number;
  y: number;
  castX: number;
  castY: number;
}

interface TackleItem {
  id: string;
  type: ItemType;
  name: string;
  loadKg: number;
  price: number;
  quantity: number;
}

interface FishingState {
  phase: FishingPhase;
  biteTimer: number;
  waitTimer: number;
  fightTimer: number;
  catchProgress: number;
  currentLoad: number;
  rodOverload: number;
  reelOverload: number;
  fishName: string;
  fishWeight: number;
  fishPrice: number;
  lastPull: PullAction;
}

const appEl = document.querySelector<HTMLDivElement>('#app');

if (!appEl) {
  throw new Error('Не найден #app');
}

const app = appEl;

const BASE_UI_WIDTH = 1280;
const BASE_UI_HEIGHT = 960;

const CATALOG: ReadonlyArray<Omit<TackleItem, 'quantity'>> = [
  { id: 'rod_basic', type: 'rod', name: 'Удилище Basic', loadKg: 6, price: 0 },
  { id: 'rod_pro', type: 'rod', name: 'Удилище Pro', loadKg: 11, price: 900 },
  { id: 'reel_basic', type: 'reel', name: 'Катушка Basic', loadKg: 5, price: 0 },
  { id: 'reel_pro', type: 'reel', name: 'Катушка Pro', loadKg: 10, price: 850 },
  { id: 'line_basic', type: 'line', name: 'Леска 0.25', loadKg: 4.5, price: 0 },
  { id: 'line_pro', type: 'line', name: 'Леска 0.35', loadKg: 8.5, price: 700 },
  { id: 'hook_basic', type: 'hook', name: 'Крючок №6', loadKg: 7, price: 0 },
  { id: 'hook_strong', type: 'hook', name: 'Крючок усиленный', loadKg: 11, price: 520 },
  { id: 'bait_worm', type: 'bait', name: 'Наживка: червь', loadKg: 7, price: 90 },
  { id: 'bait_maggot', type: 'bait', name: 'Наживка: опарыш', loadKg: 9, price: 130 },
];

let screen: Screen = 'base';
let rods: Rod[] = [];
let rodId = 0;

let money = 1200;
let totalFishCaught = 0;

let inventory: TackleItem[] = [
  { id: 'rod_basic', type: 'rod', name: 'Удилище Basic', loadKg: 6, price: 0, quantity: 1 },
  { id: 'reel_basic', type: 'reel', name: 'Катушка Basic', loadKg: 5, price: 0, quantity: 1 },
  { id: 'line_basic', type: 'line', name: 'Леска 0.25', loadKg: 4.5, price: 0, quantity: 1 },
  { id: 'hook_basic', type: 'hook', name: 'Крючок №6', loadKg: 7, price: 0, quantity: 1 },
  { id: 'bait_worm', type: 'bait', name: 'Наживка: червь', loadKg: 7, price: 90, quantity: 6 },
];

let equipped: Record<ItemType, string | null> = {
  rod: 'rod_basic',
  reel: 'reel_basic',
  line: 'line_basic',
  hook: 'hook_basic',
  bait: 'bait_worm',
};

let fishing: FishingState = {
  phase: 'idle',
  biteTimer: 0,
  waitTimer: 0,
  fightTimer: 0,
  catchProgress: 0,
  currentLoad: 0,
  rodOverload: 0,
  reelOverload: 0,
  fishName: 'Карась',
  fishWeight: 0,
  fishPrice: 0,
  lastPull: null,
};

let gPressed = false;
let hPressed = false;
let rafId = 0;
let lastTs = performance.now();

function applyViewportScale(): void {
  const viewportFit = document.querySelector<HTMLDivElement>('.viewport-fit');

  if (!viewportFit) {
    return;
  }

  const horizontalScale = (window.innerWidth - 24) / BASE_UI_WIDTH;
  const verticalScale = (window.innerHeight - 24) / BASE_UI_HEIGHT;
  const scale = Math.min(horizontalScale, verticalScale, 1);

  viewportFit.style.setProperty('--ui-scale', `${Math.max(scale, 0.35)}`);
}

function formatMoney(value: number): string {
  return `${Math.floor(value).toLocaleString('ru-RU')} руб.`;
}

function getInventoryByType(type: ItemType): TackleItem[] {
  return inventory.filter((item) => item.type === type && item.quantity > 0);
}

function getInventoryItem(id: string | null): TackleItem | null {
  if (!id) {
    return null;
  }

  return inventory.find((item) => item.id === id && item.quantity > 0) ?? null;
}

function getRigStats(): { rodLoad: number; reelLoad: number; finalLoad: number } | null {
  const rod = getInventoryItem(equipped.rod);
  const reel = getInventoryItem(equipped.reel);
  const line = getInventoryItem(equipped.line);
  const hook = getInventoryItem(equipped.hook);

  if (!rod || !reel || !line || !hook) {
    return null;
  }

  return {
    rodLoad: Math.min(rod.loadKg, line.loadKg, hook.loadKg),
    reelLoad: Math.min(reel.loadKg, line.loadKg),
    finalLoad: Math.min(rod.loadKg, reel.loadKg, line.loadKg, hook.loadKg),
  };
}

function isRodReady(): boolean {
  return Boolean(getRigStats() && getInventoryItem(equipped.bait));
}

function resetFightState(): void {
  fishing.biteTimer = 0;
  fishing.waitTimer = 0;
  fishing.fightTimer = 0;
  fishing.catchProgress = 0;
  fishing.currentLoad = 0;
  fishing.rodOverload = 0;
  fishing.reelOverload = 0;
  fishing.lastPull = null;
}

function setPhase(phase: FishingPhase, fishData?: { fishName: string; fishWeight: number; fishPrice: number }): void {
  fishing.phase = phase;

  if (fishData) {
    fishing.fishName = fishData.fishName;
    fishing.fishWeight = fishData.fishWeight;
    fishing.fishPrice = fishData.fishPrice;
  }

  if (phase === 'idle') {
    resetFightState();
    rods = [];
  }

  render();
}

function removeOneItem(itemId: string): void {
  const found = inventory.find((item) => item.id === itemId);

  if (!found || found.quantity <= 0) {
    return;
  }

  found.quantity -= 1;

  if (found.quantity <= 0) {
    (Object.keys(equipped) as ItemType[]).forEach((type) => {
      if (equipped[type] === itemId) {
        equipped[type] = null;
      }
    });
  }
}

function breakCurrentRig(): void {
  [equipped.rod, equipped.reel, equipped.line].forEach((id) => {
    if (id) {
      removeOneItem(id);
    }
  });
}

function buyItem(itemId: string): void {
  const catalogItem = CATALOG.find((entry) => entry.id === itemId);

  if (!catalogItem || money < catalogItem.price) {
    return;
  }

  money -= catalogItem.price;

  const existing = inventory.find((item) => item.id === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    inventory.push({ ...catalogItem, quantity: 1 });
  }

  if (!equipped[catalogItem.type]) {
    equipped[catalogItem.type] = catalogItem.id;
  }

  render();
}

function equipItem(itemId: string): void {
  const item = inventory.find((entry) => entry.id === itemId && entry.quantity > 0);

  if (!item) {
    return;
  }

  equipped[item.type] = item.id;
  render();
}

function startCasting(x: number, y: number): void {
  if (!isRodReady()) {
    return;
  }

  const bait = getInventoryItem(equipped.bait);
  if (!bait) {
    return;
  }

  removeOneItem(bait.id);

  rodId += 1;
  rods = [{ id: rodId, x, y, castX: x, castY: y }];

  fishing.waitTimer = 2 + Math.random() * 3;
  resetFightState();
  setPhase('waiting');
}

function generateFish(): { fishName: string; fishWeight: number; fishPrice: number } {
  const fishWeight = Number((2.5 + Math.random() * 5.5).toFixed(2));
  return {
    fishName: 'Карась',
    fishWeight,
    fishPrice: Math.round(fishWeight * 170),
  };
}

function phaseText(phase: FishingPhase): string {
  if (phase === 'idle') return 'Ожидание';
  if (phase === 'waiting') return 'Поплавок в воде';
  if (phase === 'bite') return 'Клёв! Жми SPACE';
  if (phase === 'hooked') return 'Тяни по очереди: G (удилище) → H (катушка)';
  if (phase === 'landed') return 'Рыба поймана';
  if (phase === 'escaped') return 'Сошла';
  return 'Снасть сломана';
}

function render(): void {
  const rigStats = getRigStats();

  app.innerHTML = `
    <div class="viewport-fit">
      <div class="game-root wood-bg">
        <header class="top-bar">
          <div class="money-box">Время: <b>22:50 СР</b> &nbsp;&nbsp; Деньги: <b>${formatMoney(money)}</b></div>
          <div class="menu-box">SPACE — подсечка | G → H — вываживание</div>
        </header>

        <div class="main-layout">
          <div class="left-stage">
            ${screen === 'base' ? renderBaseScreen() : ''}
            ${screen === 'map' ? renderMapScreen() : ''}
            ${screen === 'fishing' ? renderFishingScreen(rigStats) : ''}
          </div>

          <aside class="right-sidebar">
            <div class="depth-widget">
              <div class="depth-line"></div>
              <div class="depth-value">${fishing.currentLoad.toFixed(2)} кг</div>
            </div>

            <button class="mini-map" id="open-map-btn" ${screen === 'map' ? 'disabled' : ''}>Карта</button>
            <button class="base-btn" id="go-base-btn">На базу</button>

            <div class="info-card">
              <h3>Баланс: ${formatMoney(money)}</h3>
              <p>Рыбы поймано: ${totalFishCaught}</p>
              <small>Фаза: ${phaseText(fishing.phase)}</small>
              <small>Лимит удилища: ${rigStats ? `${rigStats.rodLoad.toFixed(1)} кг` : '—'}</small>
              <small>Лимит катушки: ${rigStats ? `${rigStats.reelLoad.toFixed(1)} кг` : '—'}</small>
            </div>
          </aside>
        </div>

        <div class="bottom-panel">
          <div class="status-bars">
            <div class="status-item"><span>еда</span><div class="bar"><i style="height: 28%"></i></div></div>
            <div class="status-item"><span>алк</span><div class="bar"><i style="height: 18%"></i></div></div>
          </div>

          <div class="inventory">${renderAssemblyPanel(rigStats)}</div>
          <div class="chat-area">${renderShopPanel()}</div>
        </div>
      </div>
    </div>
  `;

  bindEvents();
  applyViewportScale();
}

function renderBaseScreen(): string {
  return `
    <section class="screen base-screen">
      <div class="book-panel">
        <div class="book-title">Рыболовная база</div>
        <ul>
          <li>купить снасти (внизу справа)</li>
          <li>собрать удочку (внизу по центру)</li>
          <li>путешествие → карта справа</li>
          <li>в бою жми G, потом H — так быстрее тянется рыба</li>
        </ul>
      </div>
    </section>
  `;
}

function renderMapScreen(): string {
  return `
    <section class="screen map-screen">
      <div class="map-header">Карта водоема <button id="close-map-btn">×</button></div>
      <div class="lake-map">
        <div class="location-pin active" id="location-gold" style="left: 70%; top: 58%;"></div>
        <div class="location-label">Золотая рыбка</div>
      </div>
    </section>
  `;
}

function renderFishingScreen(rigStats: { rodLoad: number; reelLoad: number; finalLoad: number } | null): string {
  const canCast = isRodReady() && fishing.phase === 'idle';

  return `
    <section class="screen fishing-screen">
      <div class="water-overlay" id="water">
        ${rods
          .map(
            (rod) => `
            <div class="rod" style="left:${rod.x}%; top:${rod.y}%">
              <div class="float ${fishing.phase === 'bite' || fishing.phase === 'hooked' ? 'underwater' : ''}"></div>
              <div class="line"></div>
              <div class="stick"></div>
            </div>`
          )
          .join('')}
      </div>

      <div class="fishing-help">
        <div>${canCast ? 'Клик по воде — закинуть снасть' : 'Собери снасть: удилище+катушка+леска+крючок+наживка'}</div>
        <div>${phaseText(fishing.phase)}</div>
        <div>Суммарный лимит: ${rigStats ? `${rigStats.finalLoad.toFixed(1)} кг` : '—'}</div>

        <div id="fishing-bars" class="fight-bars ${fishing.phase === 'hooked' ? '' : 'hidden'}">
          <span>Прогресс вываживания</span>
          <div class="bar-track"><i id="progress-bar" style="width:${Math.min(100, fishing.catchProgress).toFixed(0)}%"></i></div>

          <span>Нагрузка удилища (G)</span>
          <div class="bar-track rod"><i id="rod-load-bar" style="width:${Math.min(100, fishing.rodOverload * 70).toFixed(0)}%"></i></div>

          <span>Нагрузка катушки (H)</span>
          <div class="bar-track reel"><i id="reel-load-bar" style="width:${Math.min(100, fishing.reelOverload * 70).toFixed(0)}%"></i></div>
        </div>
      </div>
    </section>
  `;
}

function renderAssemblyPanel(rigStats: { rodLoad: number; reelLoad: number; finalLoad: number } | null): string {
  const groups: ItemType[] = ['rod', 'reel', 'line', 'hook', 'bait'];
  const labels: Record<ItemType, string> = {
    rod: 'Удилище',
    reel: 'Катушка',
    line: 'Леска',
    hook: 'Крючок',
    bait: 'Наживка',
  };

  return `
    <div class="assembly-panel">
      <div class="panel-title">Сборка снасти</div>
      <div class="assembly-grid">
        ${groups
          .map((type) => {
            const options = getInventoryByType(type);
            return `
              <div class="assembly-cell">
                <div class="cell-title">${labels[type]}</div>
                ${options
                  .map(
                    (item) => `
                    <button class="equip-btn ${equipped[type] === item.id ? 'active' : ''}" data-equip-id="${item.id}">
                      ${item.name} (${item.loadKg}кг) x${item.quantity}
                    </button>`
                  )
                  .join('') || '<div class="no-items">нет предметов</div>'}
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="assembly-footer">
        Удилище: ${rigStats ? `${rigStats.rodLoad.toFixed(1)} кг` : '—'} | Катушка: ${rigStats ? `${rigStats.reelLoad.toFixed(1)} кг` : '—'}
      </div>
    </div>
  `;
}

function renderShopPanel(): string {
  return `
    <div class="shop-panel">
      <div class="panel-title">Магазин снастей</div>
      <div class="shop-list">
        ${CATALOG.filter((item) => item.price > 0)
          .map(
            (item) => `
            <button class="shop-btn" data-buy-id="${item.id}" ${money < item.price ? 'disabled' : ''}>
              ${item.name} • ${item.loadKg}кг • ${formatMoney(item.price)}
            </button>`
          )
          .join('')}
      </div>
    </div>
  `;
}

function bindEvents(): void {
  document.querySelector<HTMLButtonElement>('#open-map-btn')?.addEventListener('click', () => {
    screen = 'map';
    render();
  });

  document.querySelector<HTMLButtonElement>('#go-base-btn')?.addEventListener('click', () => {
    screen = 'base';
    setPhase('idle');
  });

  document.querySelector<HTMLButtonElement>('#close-map-btn')?.addEventListener('click', () => {
    screen = 'base';
    render();
  });

  document.querySelector<HTMLDivElement>('#location-gold')?.addEventListener('click', () => {
    screen = 'fishing';
    setPhase('idle');
  });

  document.querySelectorAll<HTMLButtonElement>('[data-equip-id]').forEach((button) => {
    const itemId = button.dataset.equipId;
    if (itemId) {
      button.addEventListener('click', () => equipItem(itemId));
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-buy-id]').forEach((button) => {
    const itemId = button.dataset.buyId;
    if (itemId) {
      button.addEventListener('click', () => buyItem(itemId));
    }
  });

  document.querySelector<HTMLDivElement>('#water')?.addEventListener('click', (event) => {
    if (fishing.phase !== 'idle') {
      return;
    }

    const water = event.currentTarget as HTMLDivElement;
    const rect = water.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (y <= 82) {
      startCasting(x, y);
    }
  });
}

function updateFloatPosition(): void {
  const activeRod = rods[0];

  if (!activeRod || fishing.phase !== 'hooked') {
    return;
  }

  const towardShore = fishing.catchProgress * 0.3;
  const fishPushBack = (Math.sin(fishing.fightTimer * 2.1) + 1) * 2.5;
  const sideDrift = Math.sin(fishing.fightTimer * 1.9) * 0.25;

  activeRod.y = Math.max(18, Math.min(80, activeRod.castY + towardShore - fishPushBack));
  activeRod.x = Math.max(8, Math.min(92, activeRod.castX + sideDrift));
}

function updateFishing(dt: number): void {
  if (screen !== 'fishing') {
    return;
  }

  if (fishing.phase === 'waiting') {
    fishing.waitTimer -= dt;
    if (fishing.waitTimer <= 0) {
      fishing.biteTimer = 1.8;
      setPhase('bite', generateFish());
    }
    return;
  }

  if (fishing.phase === 'bite') {
    fishing.biteTimer -= dt;
    if (fishing.biteTimer <= 0) {
      setPhase('escaped');
      window.setTimeout(() => setPhase('idle'), 1200);
    }
    return;
  }

  if (fishing.phase !== 'hooked') {
    return;
  }

  const rigStats = getRigStats();

  if (!rigStats) {
    setPhase('broken');
    window.setTimeout(() => setPhase('idle'), 1200);
    return;
  }

  fishing.fightTimer += dt;

  const fishBasePull = 0.9 + fishing.fishWeight * 0.45 + Math.abs(Math.sin(fishing.fightTimer * 3.1)) * 0.7;
  const rodLoadNow = fishBasePull + (gPressed ? 1.4 : 0.1) + (hPressed ? 0.15 : 0);
  const reelLoadNow = fishBasePull + (hPressed ? 1.35 : 0.1) + (gPressed ? 0.15 : 0);

  fishing.currentLoad = (rodLoadNow + reelLoadNow) / 2;

  const isAlternatingBoost = (gPressed && fishing.lastPull === 'reel') || (hPressed && fishing.lastPull === 'rod');
  const rodPower = gPressed ? (isAlternatingBoost ? 22 : 12) : -2.2;
  const reelPower = hPressed ? (fishing.lastPull === 'rod' ? 20 : 7) : -2.2;
  fishing.catchProgress += (rodPower + reelPower) * dt;
  fishing.catchProgress = Math.max(0, Math.min(100, fishing.catchProgress));

  if (gPressed) {
    fishing.lastPull = 'rod';
  } else if (hPressed) {
    fishing.lastPull = 'reel';
  }

  if (gPressed && rodLoadNow > rigStats.rodLoad) {
    fishing.rodOverload += (rodLoadNow - rigStats.rodLoad) * dt;
  } else {
    fishing.rodOverload = Math.max(0, fishing.rodOverload - dt * 1.1);
  }

  if (hPressed && reelLoadNow > rigStats.reelLoad) {
    fishing.reelOverload += (reelLoadNow - rigStats.reelLoad) * dt;
  } else {
    fishing.reelOverload = Math.max(0, fishing.reelOverload - dt * 1.1);
  }

  updateFloatPosition();

  if (fishing.rodOverload >= 1.35 || fishing.reelOverload >= 1.35) {
    breakCurrentRig();
    setPhase('broken');
    window.setTimeout(() => setPhase('idle'), 1400);
    return;
  }

  if (fishing.catchProgress >= 100) {
    totalFishCaught += 1;
    money += fishing.fishPrice;
    setPhase('landed');
    window.setTimeout(() => setPhase('idle'), 1400);
    return;
  }

  if (fishing.fightTimer >= 26) {
    setPhase('escaped');
    window.setTimeout(() => setPhase('idle'), 1200);
    return;
  }

  renderHudOnly();
}

function renderHudOnly(): void {
  const depthValue = document.querySelector<HTMLDivElement>('.depth-value');
  if (depthValue) {
    depthValue.textContent = `${fishing.currentLoad.toFixed(2)} кг`;
  }

  const progressBar = document.querySelector<HTMLDivElement>('#progress-bar');
  const rodLoadBar = document.querySelector<HTMLDivElement>('#rod-load-bar');
  const reelLoadBar = document.querySelector<HTMLDivElement>('#reel-load-bar');

  if (progressBar) {
    progressBar.style.width = `${Math.min(100, fishing.catchProgress).toFixed(0)}%`;
  }

  if (rodLoadBar) {
    rodLoadBar.style.width = `${Math.min(100, fishing.rodOverload * 70).toFixed(0)}%`;
  }

  if (reelLoadBar) {
    reelLoadBar.style.width = `${Math.min(100, fishing.reelOverload * 70).toFixed(0)}%`;
  }

  const rodEl = document.querySelector<HTMLDivElement>('.rod');
  if (rodEl && rods[0]) {
    rodEl.style.left = `${rods[0].x}%`;
    rodEl.style.top = `${rods[0].y}%`;
  }
}

function gameLoop(ts: number): void {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  updateFishing(dt);
  rafId = requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', applyViewportScale);

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyG') {
    gPressed = true;
  }

  if (event.code === 'KeyH') {
    hPressed = true;
  }

  if (event.code === 'Space' && fishing.phase === 'bite') {
    event.preventDefault();
    fishing.catchProgress = 6;
    fishing.fightTimer = 0;
    fishing.rodOverload = 0;
    fishing.reelOverload = 0;
    setPhase('hooked');
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyG') {
    gPressed = false;
  }

  if (event.code === 'KeyH') {
    hPressed = false;
  }
});

render();

if (rafId === 0) {
  rafId = requestAnimationFrame(gameLoop);
}
