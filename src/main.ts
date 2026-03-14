import './styles.css';

import { LOCATIONS, type FishSpecies, type LocationData } from './data/fishing-config';

type Screen = 'base' | 'map' | 'fishing';
type ItemType = 'rod' | 'reel' | 'line' | 'hook' | 'bait';
type FishingPhase = 'idle' | 'waiting' | 'bite' | 'hooked' | 'landed' | 'escaped' | 'broken';
type PullAction = 'rod' | 'reel' | null;
type UtilityPanel = 'shop' | 'keepnet';
type BiteType = 'sink' | 'run';
type FishFightPattern = 'struggle' | 'run' | 'rest' | 'headshake' | 'deeppull';

interface Rod {
  id: number;
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

interface CaughtFish {
  id: string;
  name: string;
  weight: number;
  price: number;
  pullFactor: number;
  isTrophy: boolean;
  locationName: string;
  strength: number;
  staminaMax: number;
  aggression: number;
  escapeSkill: number;
  runPower: number;
  fatigueRate: number;
  recoveryRate: number;
  preferredFightPattern: FishFightPattern;
}

interface FishingState {
  phase: FishingPhase;
  biteTimer: number;
  biteType: BiteType;
  biteDirection: 1 | -1;
  waitTimer: number;
  fightTimer: number;
  catchProgress: number;
  currentLoad: number;
  rodOverload: number;
  reelOverload: number;
  rodTension: number;
  reelTension: number;
  fish: CaughtFish | null;
  lastPull: PullAction;
  floatX: number;
  floatY: number;
  bobberCut: number;
  fishDistance: number;
  fishStartDistance: number;
  fishVelocity: number;
  fishStamina: number;
  fishStaminaMax: number;
  escapeMeter: number;
  lineWear: number;
  rodWear: number;
  reelWear: number;
  dragSetting: number;
  fishPattern: FishFightPattern;
  fishPatternTimer: number;
  rodCriticalHold: number;
  reelCriticalHold: number;
}

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('Не найден #app');
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

const WEEK_DAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const;
let gameClockMinutes = 2 * 24 * 60 + 22 * 60 + 50;
let gameClockAccumulator = 0;
let currentLocationId = 'gold_lake';
let keepnet: CaughtFish[] = [];
let activeUtilityPanel: UtilityPanel = 'shop';

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
  biteType: 'sink',
  biteDirection: 1,
  waitTimer: 0,
  fightTimer: 0,
  catchProgress: 0,
  currentLoad: 0,
  rodOverload: 0,
  reelOverload: 0,
  rodTension: 0,
  reelTension: 0,
  fish: null,
  lastPull: null,
  floatX: 0,
  floatY: 0,
  bobberCut: 0,
  fishDistance: 0,
  fishStartDistance: 0,
  fishVelocity: 0,
  fishStamina: 0,
  fishStaminaMax: 0,
  escapeMeter: 0,
  lineWear: 0,
  rodWear: 0,
  reelWear: 0,
  dragSetting: 0.55,
  fishPattern: 'struggle',
  fishPatternTimer: 0,
  rodCriticalHold: 0,
  reelCriticalHold: 0,
};

let gPressed = false;
let hPressed = false;
let rafId = 0;
let lastTs = performance.now();
let debugVisible = false;
let audioContext: AudioContext | null = null;

function applyViewportScale(): void {
  const viewportFit = document.querySelector<HTMLDivElement>('.viewport-fit');
  if (!viewportFit) return;
  const horizontalScale = (window.innerWidth - 24) / BASE_UI_WIDTH;
  const verticalScale = (window.innerHeight - 24) / BASE_UI_HEIGHT;
  viewportFit.style.setProperty('--ui-scale', `${Math.max(Math.min(horizontalScale, verticalScale, 1), 0.35)}`);
}

function formatMoney(value: number): string {
  return `${Math.floor(value).toLocaleString('ru-RU')} руб.`;
}

function formatGameTime(totalMinutes: number): string {
  const dayIndex = Math.floor(totalMinutes / (24 * 60)) % WEEK_DAYS.length;
  const minuteOfDay = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
  const minutes = (minuteOfDay % 60).toString().padStart(2, '0');
  return `${hours}:${minutes} ${WEEK_DAYS[dayIndex]}`;
}

function updateGameClock(dt: number): void {
  gameClockAccumulator += dt;
  const stepSeconds = 10;
  while (gameClockAccumulator >= stepSeconds) {
    gameClockAccumulator -= stepSeconds;
    gameClockMinutes += 10;
  }
}

function getInventoryByType(type: ItemType): TackleItem[] {
  return inventory.filter((item) => item.type === type && item.quantity > 0);
}

function getInventoryItem(id: string | null): TackleItem | null {
  if (!id) return null;
  return inventory.find((item) => item.id === id && item.quantity > 0) ?? null;
}

function getCurrentLocation(): LocationData {
  return LOCATIONS.find((loc) => loc.id === currentLocationId) ?? LOCATIONS[0];
}

function getKeepnetTotalPrice(): number {
  return keepnet.reduce((sum, fish) => sum + fish.price, 0);
}

function sellKeepnet(): void {
  if (keepnet.length === 0) return;
  money += getKeepnetTotalPrice();
  keepnet = [];
  render();
}

function getRigStats(): { rodLoad: number; reelLoad: number; finalLoad: number } | null {
  const rod = getInventoryItem(equipped.rod);
  const reel = getInventoryItem(equipped.reel);
  const line = getInventoryItem(equipped.line);
  const hook = getInventoryItem(equipped.hook);
  if (!rod || !reel || !line || !hook) return null;

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
  fishing.biteType = 'sink';
  fishing.biteDirection = 1;
  fishing.waitTimer = 0;
  fishing.fightTimer = 0;
  fishing.catchProgress = 0;
  fishing.currentLoad = 0;
  fishing.rodOverload = 0;
  fishing.reelOverload = 0;
  fishing.rodTension = 0;
  fishing.reelTension = 0;
  fishing.lastPull = null;
  fishing.floatX = 0;
  fishing.floatY = 0;
  fishing.bobberCut = 0;
  fishing.fishDistance = 0;
  fishing.fishStartDistance = 0;
  fishing.fishVelocity = 0;
  fishing.fishStamina = 0;
  fishing.fishStaminaMax = 0;
  fishing.escapeMeter = 0;
  fishing.lineWear = 0;
  fishing.rodWear = 0;
  fishing.reelWear = 0;
  fishing.dragSetting = 0.55;
  fishing.fishPattern = 'struggle';
  fishing.fishPatternTimer = 0;
  fishing.rodCriticalHold = 0;
  fishing.reelCriticalHold = 0;
  fishing.fish = null;
}

function setPhase(phase: FishingPhase, fishData?: CaughtFish): void {
  fishing.phase = phase;
  if (fishData) fishing.fish = fishData;

  if (phase === 'idle') {
    resetFightState();
    rods = [];
  }

  render();
}

function removeOneItem(itemId: string): void {
  const found = inventory.find((item) => item.id === itemId);
  if (!found || found.quantity <= 0) return;
  found.quantity -= 1;

  if (found.quantity <= 0) {
    (Object.keys(equipped) as ItemType[]).forEach((type) => {
      if (equipped[type] === itemId) equipped[type] = null;
    });
  }
}

function breakCurrentRig(): void {
  [equipped.rod, equipped.reel, equipped.line].forEach((id) => {
    if (id) removeOneItem(id);
  });
}

function breakRigPart(part: 'rod' | 'reel' | 'line'): void {
  const itemId = equipped[part];
  if (!itemId) return;
  removeOneItem(itemId);
}

function buyItem(itemId: string): void {
  const catalogItem = CATALOG.find((entry) => entry.id === itemId);
  if (!catalogItem || money < catalogItem.price) return;

  money -= catalogItem.price;
  const existing = inventory.find((item) => item.id === itemId);

  if (existing) existing.quantity += 1;
  else inventory.push({ ...catalogItem, quantity: 1 });

  if (!equipped[catalogItem.type]) equipped[catalogItem.type] = catalogItem.id;
  render();
}

function equipItem(itemId: string): void {
  const item = inventory.find((entry) => entry.id === itemId && entry.quantity > 0);
  if (!item) return;
  equipped[item.type] = item.id;
  render();
}

function createCaughtFish(species: FishSpecies, locationName: string): CaughtFish {
  const weight = Number((species.minWeightKg + Math.random() * (species.maxWeightKg - species.minWeightKg)).toFixed(2));
  const isTrophy = weight >= species.trophyWeightKg;
  const pricePerKg = isTrophy ? species.trophyPricePerKg : species.regularPricePerKg;

  const normalizedWeight = Math.max(0.4, weight);

  return {
    id: species.id,
    name: species.name,
    weight,
    pullFactor: species.pullFactor,
    price: Math.round(weight * pricePerKg),
    isTrophy,
    locationName,
    strength: 0.8 + species.pullFactor * 0.85 + normalizedWeight * 0.22,
    staminaMax: 42 + normalizedWeight * 14 + species.pullFactor * 22,
    aggression: 0.2 + Math.min(0.75, species.pullFactor * 0.35),
    escapeSkill: 0.14 + Math.min(0.8, normalizedWeight * 0.035),
    runPower: 1.1 + normalizedWeight * 0.18 + species.pullFactor * 0.3,
    fatigueRate: 0.85 + species.pullFactor * 0.32,
    recoveryRate: 0.55 + normalizedWeight * 0.06,
    preferredFightPattern: species.pullFactor > 1.45 ? 'deeppull' : species.pullFactor > 1.15 ? 'run' : 'struggle',
  };
}

function rollFishForLocation(location: LocationData): CaughtFish {
  const totalChance = location.fishes.reduce((sum, fish) => sum + fish.chance, 0);
  let roll = Math.random() * totalChance;
  let selected = location.fishes[0];

  for (const fish of location.fishes) {
    roll -= fish.chance;
    if (roll <= 0) {
      selected = fish;
      break;
    }
  }

  return createCaughtFish(selected, location.name);
}

function startCasting(x: number, y: number): void {
  if (!isRodReady()) return;
  const bait = getInventoryItem(equipped.bait);
  if (!bait) return;

  removeOneItem(bait.id);

  rodId += 1;
  rods = [{ id: rodId, castX: x, castY: y }];
  fishing.floatX = x;
  fishing.floatY = y;
  fishing.bobberCut = 0;

  fishing.waitTimer = 2 + Math.random() * 3;
  fishing.fish = rollFishForLocation(getCurrentLocation());
  fishing.catchProgress = 0;
  fishing.fightTimer = 0;
  fishing.rodOverload = 0;
  fishing.reelOverload = 0;
  fishing.rodTension = 0;
  fishing.reelTension = 0;
  fishing.currentLoad = 0;
  fishing.lastPull = null;
  fishing.fishDistance = 0;
  fishing.fishStartDistance = 0;
  fishing.fishVelocity = 0;
  fishing.fishStamina = 0;
  fishing.fishStaminaMax = 0;
  fishing.escapeMeter = 0;
  fishing.lineWear = 0;
  fishing.rodWear = 0;
  fishing.reelWear = 0;
  fishing.fishPattern = 'struggle';
  fishing.fishPatternTimer = 0;
  fishing.rodCriticalHold = 0;
  fishing.reelCriticalHold = 0;

  setPhase('waiting');
}

function playBiteSignal(): void {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.0001;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;
    gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscillator.start(now);
    oscillator.stop(now + 0.23);
  } catch {
    // ignore audio errors in restricted environments
  }
}

function phaseText(phase: FishingPhase): string {
  if (phase === 'idle') return 'Ожидание';
  if (phase === 'waiting') return 'Поплавок в воде';
  if (phase === 'bite') return 'Клёв! Жми SPACE';
  if (phase === 'hooked') return 'Борьба: держи натяг в зоне, G/H + Q/E';
  if (phase === 'landed') return 'Рыба в садке';
  if (phase === 'escaped') return 'Сошла';
  return 'Снасть сломана';
}

function renderKeepnetList(): string {
  if (keepnet.length === 0) return '<div class="no-items">Садок пуст</div>';

  return keepnet
    .slice()
    .reverse()
    .map(
      (fish) => `<div class="keepnet-item ${fish.isTrophy ? 'trophy' : ''}"><b>${fish.name}</b> • ${fish.weight.toFixed(2)} кг • ${fish.locationName}<br/>${fish.isTrophy ? 'Зачетная' : 'Обычная'} — ${formatMoney(fish.price)}</div>`
    )
    .join('');
}

function renderShopPanelCategorized(): string {
  const categories: Array<{ type: ItemType; title: string }> = [
    { type: 'rod', title: 'Удилища' },
    { type: 'reel', title: 'Катушки' },
    { type: 'line', title: 'Леска' },
    { type: 'hook', title: 'Крючки' },
    { type: 'bait', title: 'Наживка' },
  ];

  return `
    <div class="shop-panel">
      <div class="panel-title">Магазин снастей</div>
      <div class="shop-list">
        ${categories
          .map((category) => {
            const items = CATALOG.filter((item) => item.type === category.type && item.price > 0);

            return `
              <div class="shop-category">
                <div class="shop-category-title">${category.title}</div>
                ${
                  items
                    .map(
                      (item) => `<button class="shop-btn" data-buy-id="${item.id}" ${money < item.price ? 'disabled' : ''}>${item.name} • ${item.loadKg}кг • ${formatMoney(item.price)}</button>`
                    )
                    .join('') || '<div class="no-items">нет товаров</div>'
                }
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderUtilityPanel(): string {
  return `
    <div class="utility-icons">
      <button class="utility-btn ${activeUtilityPanel === 'shop' ? 'active' : ''}" id="open-shop-btn" title="Магазин">
        <span class="utility-emoji">🛒</span>
        <span>магазин</span>
      </button>
      <button class="utility-btn ${activeUtilityPanel === 'keepnet' ? 'active' : ''}" id="open-keepnet-btn" title="Садок">
        <span class="utility-emoji">🧺</span>
        <span>садок <small>${keepnet.length}</small></span>
      </button>
    </div>
    <div class="utility-content">
      ${activeUtilityPanel === 'shop' ? renderShopPanelCategorized() : `<div class="keepnet-panel"><div class="panel-title">Садок</div>${renderKeepnetList()}</div>`}
    </div>
  `;
}

function render(): void {
  const rigStats = getRigStats();
  const location = getCurrentLocation();
  const keepnetTotal = getKeepnetTotalPrice();

  app.innerHTML = `
    <div class="viewport-fit">
      <div class="game-root wood-bg">
        <header class="top-bar">
          <div class="money-box">Время: <b>${formatGameTime(gameClockMinutes)}</b> &nbsp;&nbsp; Деньги: <b>${formatMoney(money)}</b></div>
          <div class="menu-box">SPACE — подсечка | G/H — вываживание | Q/E — фрикцион</div>
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
              <p>Локация: ${location.name}</p>
              <small>Рыбы поймано: ${totalFishCaught}</small>
              <small>Садок: ${keepnet.length} шт, ${formatMoney(keepnetTotal)}</small>
              <small>Удилище: ${rigStats ? `${rigStats.rodLoad.toFixed(1)} кг` : '—'} | Катушка: ${rigStats ? `${rigStats.reelLoad.toFixed(1)} кг` : '—'}</small>
              <button class="sell-btn" id="sell-keepnet-btn" ${keepnet.length === 0 ? 'disabled' : ''}>Продать садок</button>
            </div>
          </aside>
        </div>

        <div class="bottom-panel">
          <div class="status-bars">
            <div class="status-item"><span>еда</span><div class="bar"><i style="height: 28%"></i></div></div>
            <div class="status-item"><span>алк</span><div class="bar"><i style="height: 18%"></i></div></div>
          </div>

          <div class="inventory">${renderAssemblyPanel(rigStats)}</div>
          <div class="chat-area">
            ${renderUtilityPanel()}
          </div>
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
          <li>рыба идет в садок, продажа вручную</li>
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
        ${LOCATIONS.map(
          (loc) => `<div class="location-pin ${loc.id === 'gold_lake' ? 'active' : ''} ${loc.id === currentLocationId ? 'selected' : ''}" data-location-id="${loc.id}" style="left:${loc.mapX}%; top:${loc.mapY}%;"></div>`
        ).join('')}
        <div class="location-label">${getCurrentLocation().name}</div>
      </div>
    </section>
  `;
}

function renderFishingScreen(rigStats: { rodLoad: number; reelLoad: number; finalLoad: number } | null): string {
  const activeRod = rods[0];
  const location = getCurrentLocation();
  const fishMarker = getFishMarkerPosition();

  return `
    <section class="screen fishing-screen" style="${location.sceneImage ? `--lake-image:url('${location.sceneImage}')` : ''}">
      <div class="water-overlay" id="water">
        ${activeRod ? `<div class="rod" style="left:${activeRod.castX}%;"><div class="line"></div><div class="stick"></div></div>` : ''}
        ${
          activeRod
            ? `<div id="bobber" class="float bobber ${fishing.phase === 'bite' && fishing.biteType === 'run' ? 'run' : ''} ${fishing.phase === 'bite' && fishing.biteType === 'sink' ? 'bite-sink' : ''} ${fishing.phase === 'hooked' && fishing.biteType === 'run' ? 'run hooked-run' : ''} ${fishing.phase === 'hooked' && fishing.biteType === 'sink' ? 'dot' : ''}" style="left:${fishing.floatX}%; top:${fishing.floatY}%; --bobber-cut:${fishing.bobberCut.toFixed(2)}"></div>`
            : ''
        }
        ${
          fishMarker
            ? `<div id="fish-marker" class="fish-marker" style="left:${fishMarker.x.toFixed(2)}%; top:${fishMarker.y.toFixed(2)}%"></div>`
            : ''
        }
      </div>

      <div class="tension-widget">
        <div class="tension-meter">
          <div class="tension-title">Удилище</div>
          <div class="tension-track tension-track--rod"><i id="rod-load-bar" style="width:${Math.max(0, Math.min(100, fishing.rodTension * 100)).toFixed(0)}%"></i></div>
        </div>
        <div class="tension-meter">
          <div class="tension-title">Катушка</div>
          <div class="tension-track tension-track--reel"><i id="reel-load-bar" style="width:${Math.max(0, Math.min(100, fishing.reelTension * 100)).toFixed(0)}%"></i></div>
        </div>
      </div>

      ${
        debugVisible
          ? `<div class="debug-panel">phase: ${phaseText(fishing.phase)}<br/>fish: ${fishing.fish ? `${fishing.fish.name} ${fishing.fish.weight.toFixed(2)}кг` : '—'}<br/>distance: ${fishing.fishDistance.toFixed(1)}м<br/>stamina: ${fishing.fishStamina.toFixed(0)} / ${fishing.fishStaminaMax.toFixed(0)}<br/>pattern: ${fishing.fishPattern}<br/>drag: ${(fishing.dragSetting * 100).toFixed(0)}%<br/>wear L/Rd/Rl: ${fishing.lineWear.toFixed(0)} / ${fishing.rodWear.toFixed(0)} / ${fishing.reelWear.toFixed(0)}</div>`
          : ''
      }
    </section>
  `;
}

function renderAssemblyPanel(rigStats: { rodLoad: number; reelLoad: number; finalLoad: number } | null): string {
  const groups: ItemType[] = ['rod', 'reel', 'line', 'hook', 'bait'];
  const labels: Record<ItemType, string> = { rod: 'Удилище', reel: 'Катушка', line: 'Леска', hook: 'Крючок', bait: 'Наживка' };

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
                ${
                  options
                    .map(
                      (item) => `<button class="equip-btn ${equipped[type] === item.id ? 'active' : ''}" data-equip-id="${item.id}">${item.name} (${item.loadKg}кг) x${item.quantity}</button>`
                    )
                    .join('') || '<div class="no-items">нет предметов</div>'
                }
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="assembly-footer">Удилище: ${rigStats ? `${rigStats.rodLoad.toFixed(1)} кг` : '—'} | Катушка: ${rigStats ? `${rigStats.reelLoad.toFixed(1)} кг` : '—'}</div>
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

  document.querySelector<HTMLButtonElement>('#sell-keepnet-btn')?.addEventListener('click', () => {
    sellKeepnet();
  });

  document.querySelector<HTMLButtonElement>('#open-shop-btn')?.addEventListener('click', () => {
    activeUtilityPanel = 'shop';
    render();
  });

  document.querySelector<HTMLButtonElement>('#open-keepnet-btn')?.addEventListener('click', () => {
    activeUtilityPanel = 'keepnet';
    render();
  });

  document.querySelector<HTMLButtonElement>('#close-map-btn')?.addEventListener('click', () => {
    screen = 'base';
    render();
  });

  document.querySelectorAll<HTMLDivElement>('[data-location-id]').forEach((el) => {
    const id = el.dataset.locationId;
    if (!id) return;

    el.addEventListener('click', () => {
      currentLocationId = id;
      if (id === 'gold_lake') {
        screen = 'fishing';
        setPhase('idle');
      } else {
        render();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-equip-id]').forEach((button) => {
    const itemId = button.dataset.equipId;
    if (itemId) button.addEventListener('click', () => equipItem(itemId));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-buy-id]').forEach((button) => {
    const itemId = button.dataset.buyId;
    if (itemId) button.addEventListener('click', () => buyItem(itemId));
  });

  document.querySelector<HTMLDivElement>('#water')?.addEventListener('click', (event) => {
    if (fishing.phase !== 'idle') return;
    const water = event.currentTarget as HTMLDivElement;
    const rect = water.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (y <= 82) startCasting(x, y);
  });
}

function updateFloatPosition(): void {
  const activeRod = rods[0];
  if (!activeRod || fishing.phase !== 'hooked') return;

  const maxDistance = Math.max(1, fishing.fishStartDistance);
  const distanceRatio = Math.max(0, Math.min(1, fishing.fishDistance / maxDistance));
  const towardShore = (1 - distanceRatio) * 18;
  const wave = Math.sin(fishing.fightTimer * 2.2) * (1.1 + fishing.fishVelocity * 0.35);
  const patternDrift =
    fishing.fishPattern === 'run'
      ? Math.sin(fishing.fightTimer * 4.4) * 4.8
      : fishing.fishPattern === 'headshake'
        ? Math.sin(fishing.fightTimer * 9.8) * 2.7
        : Math.sin(fishing.fightTimer * 1.6) * 1.2;

  fishing.floatX = Math.max(8, Math.min(92, activeRod.castX + patternDrift));
  fishing.floatY = Math.max(16, Math.min(82, activeRod.castY + distanceRatio * 3.2 - towardShore * 0.25 + wave));
  fishing.bobberCut = fishing.biteType === 'sink' ? 1 : 0;
}

function getFishMarkerPosition(): { x: number; y: number } | null {
  const activeRod = rods[0];
  if (!activeRod || fishing.phase !== 'hooked') return null;

  const maxDistance = Math.max(1, fishing.fishStartDistance);
  const distanceRatio = Math.max(0, Math.min(1, fishing.fishDistance / maxDistance));
  const progressToShore = 1 - distanceRatio;
  const lateralDrift =
    fishing.fishPattern === 'run'
      ? Math.sin(fishing.fightTimer * 4.4) * 4.2
      : fishing.fishPattern === 'headshake'
        ? Math.sin(fishing.fightTimer * 8.6) * 2.4
        : Math.sin(fishing.fightTimer * 1.8) * 1.4;
  const wave = Math.sin(fishing.fightTimer * 2.4) * (0.3 + fishing.fishVelocity * 0.2);

  const x = Math.max(6, Math.min(94, activeRod.castX + lateralDrift));
  const farY = Math.max(16, activeRod.castY - 4);
  const shoreY = 85.5;
  const y = Math.max(12, Math.min(87, farY + progressToShore * (shoreY - farY) + wave));

  return { x, y };
}

function updateBiteAnimation(): void {
  const activeRod = rods[0];
  if (!activeRod || fishing.phase !== 'bite') return;

  if (fishing.biteType === 'sink') {
    const shake = Math.sin(fishing.fightTimer * 36) * 0.18;
    const pulse = (Math.sin(fishing.fightTimer * 24) + 1) * 0.5;
    const deep = Math.max(0, 1.8 - fishing.biteTimer) * 0.48;
    fishing.floatX = activeRod.castX + shake;
    fishing.floatY = Math.min(84, activeRod.castY + deep);
    fishing.bobberCut = Math.max(0.35, Math.min(1, 0.45 + pulse * 0.46 + deep * 0.24));
    return;
  }

  const runProgress = Math.max(0, 1.8 - fishing.biteTimer);
  const side = fishing.biteDirection * (runProgress * 9 + Math.sin(fishing.fightTimer * 18) * 0.6);
  fishing.floatX = Math.max(6, Math.min(94, activeRod.castX + side));
  fishing.floatY = Math.max(16, Math.min(82, activeRod.castY - 0.2 + Math.sin(fishing.fightTimer * 10) * 0.3));
  fishing.bobberCut = 0;
}

function chooseNextFishPattern(fish: CaughtFish): FishFightPattern {
  const roll = Math.random();
  if (roll < fish.aggression * 0.33) return 'run';
  if (roll < fish.aggression * 0.56) return 'headshake';
  if (roll < 0.66) return fish.preferredFightPattern;
  if (roll < 0.82) return 'struggle';
  return 'rest';
}

function getPatternForceMultiplier(pattern: FishFightPattern, fish: CaughtFish): number {
  if (pattern === 'run') return 1.2 + fish.runPower * 0.14;
  if (pattern === 'headshake') return 1.08 + fish.aggression * 0.22;
  if (pattern === 'deeppull') return 1.16 + fish.runPower * 0.08;
  if (pattern === 'rest') return 0.62;
  return 1;
}

function initFightIfNeeded(activeFish: CaughtFish): void {
  if (fishing.fishStaminaMax > 0) return;
  fishing.fishStaminaMax = activeFish.staminaMax;
  fishing.fishStamina = activeFish.staminaMax;
  fishing.fishStartDistance = Math.min(78, 26 + activeFish.weight * 4.8 + activeFish.runPower * 3.5);
  fishing.fishDistance = fishing.fishStartDistance;
  fishing.escapeMeter = 0;
  fishing.lineWear = 0;
  fishing.rodWear = 0;
  fishing.reelWear = 0;
  fishing.fishPattern = activeFish.preferredFightPattern;
  fishing.fishPatternTimer = 1.2 + Math.random() * 1.2;
}

function updateFishing(dt: number): void {
  if (screen !== 'fishing') return;

  if (fishing.phase === 'waiting') {
    fishing.waitTimer -= dt;
    fishing.fightTimer += dt;
    fishing.rodTension = 0;
    fishing.reelTension = 0;
    fishing.bobberCut = 0;
    if (fishing.waitTimer <= 0 && fishing.fish) {
      fishing.biteTimer = 1.8;
      fishing.biteType = Math.random() > 0.5 ? 'sink' : 'run';
      fishing.biteDirection = Math.random() > 0.5 ? 1 : -1;
      playBiteSignal();
      setPhase('bite', fishing.fish);
    }
    renderHudOnly();
    return;
  }

  if (fishing.phase === 'bite') {
    fishing.fightTimer += dt;
    fishing.biteTimer -= dt;
    updateBiteAnimation();
    fishing.rodTension = 0;
    fishing.reelTension = 0;
    if (fishing.biteTimer <= 0) {
      setPhase('escaped');
      window.setTimeout(() => setPhase('idle'), 1200);
    }
    renderHudOnly();
    return;
  }

  if (fishing.phase !== 'hooked') return;

  const rigStats = getRigStats();
  const activeFish = fishing.fish;

  if (!rigStats || !activeFish) {
    setPhase('broken');
    window.setTimeout(() => setPhase('idle'), 1200);
    return;
  }

  initFightIfNeeded(activeFish);
  fishing.fightTimer += dt;

  fishing.fishPatternTimer -= dt;
  if (fishing.fishPatternTimer <= 0) {
    fishing.fishPattern = chooseNextFishPattern(activeFish);
    fishing.fishPatternTimer = 0.9 + Math.random() * 1.7;
  }

  const staminaRatio = Math.max(0.05, fishing.fishStamina / Math.max(1, fishing.fishStaminaMax));
  const patternForce = getPatternForceMultiplier(fishing.fishPattern, activeFish);
  const burst = fishing.fishPattern === 'run' ? Math.abs(Math.sin(fishing.fightTimer * 6.2)) * activeFish.runPower : 0;
  const fishForce = activeFish.strength * patternForce * (0.62 + staminaRatio * 0.78) + burst;

  const rodForce = gPressed ? (0.95 + rigStats.rodLoad * 0.24) * (0.95 + fishing.dragSetting * 0.2) : 0;
  const reelEfficiency = gPressed ? 1 : 0.48;
  const reelForce = hPressed ? (0.8 + rigStats.reelLoad * 0.2) * reelEfficiency : 0;
  const dragRelief = (1 - fishing.dragSetting) * (1.8 + rigStats.reelLoad * 0.08);

  const rawTensionKg = Math.max(0, fishForce + rodForce + reelForce - dragRelief);
  const tensionRatio = rawTensionKg / Math.max(0.75, rigStats.finalLoad);
  const fishToRigRatio = Math.max(0.35, activeFish.weight / Math.max(0.6, rigStats.finalLoad));
  const pressureFactor = Math.max(0.2, fishForce / Math.max(0.5, rigStats.finalLoad));
  const overloadGainBase = Math.max(0.04, (fishToRigRatio * 0.16 + pressureFactor * 0.12 + Math.max(0, tensionRatio - 0.52) * 0.3));
  const overloadDecayBase = 0.2 + Math.max(0, 0.35 - fishToRigRatio) * 0.35;

  const rodPressure = rawTensionKg / Math.max(0.55, rigStats.rodLoad);
  const reelPressure = rawTensionKg / Math.max(0.55, rigStats.reelLoad);

  fishing.currentLoad = rawTensionKg;

  if (gPressed) {
    const rodGain = overloadGainBase * (0.55 + Math.min(1.8, rodPressure));
    fishing.rodTension = Math.min(1, fishing.rodTension + rodGain * dt);
  } else {
    const rodDecay = overloadDecayBase * (0.85 + fishing.rodTension);
    fishing.rodTension = Math.max(0, fishing.rodTension - rodDecay * dt);
  }

  if (hPressed) {
    const reelGain = overloadGainBase * (0.55 + Math.min(1.8, reelPressure));
    fishing.reelTension = Math.min(1, fishing.reelTension + reelGain * dt);
  } else {
    const reelDecay = overloadDecayBase * (0.85 + fishing.reelTension);
    fishing.reelTension = Math.max(0, fishing.reelTension - reelDecay * dt);
  }

  const inFightWindow = tensionRatio >= 0.45 && tensionRatio <= 0.86;
  const playerControl = rodForce * 0.9 + reelForce * 1.2 + (inFightWindow && (gPressed || hPressed) ? 1 : 0);
  const fishControl = fishForce + (fishing.fishPattern === 'headshake' ? 0.8 : 0) + (fishing.fishPattern === 'deeppull' ? 0.6 : 0);

  const fishWeightResistance = Math.max(0.55, Math.min(2.1, activeFish.weight / Math.max(0.8, rigStats.finalLoad) + 0.7));
  const pullInput = (gPressed ? 1 : 0) + (hPressed ? 1 : 0);
  const playerTowardShore = playerControl * (0.85 + pullInput * 0.18) / fishWeightResistance;
  const fishPushAway = fishControl * (0.65 + fishWeightResistance * 0.35);
  const controlDelta = (fishPushAway - playerTowardShore) * dt * 0.62;
  const steadyPullToShore = pullInput > 0 ? (0.06 + (2.2 - fishWeightResistance) * 0.035) * pullInput * dt : 0;
  const distanceDelta = controlDelta - steadyPullToShore;

  fishing.fishDistance = Math.max(0, Math.min(fishing.fishStartDistance * 1.7, fishing.fishDistance + distanceDelta));
  fishing.fishVelocity = fishing.fishVelocity * 0.74 + Math.abs(distanceDelta) * 0.26;

  if (inFightWindow && (gPressed || hPressed)) {
    fishing.fishStamina = Math.max(0, fishing.fishStamina - activeFish.fatigueRate * (0.72 + tensionRatio * 0.55) * dt);
  } else if (tensionRatio < 0.25) {
    fishing.fishStamina = Math.min(fishing.fishStaminaMax, fishing.fishStamina + activeFish.recoveryRate * (0.65 + (0.25 - tensionRatio) * 2.2) * dt);
  }

  const lowControl = tensionRatio < 0.18;
  if (lowControl) {
    const panicMultiplier = fishing.fishPattern === 'run' || fishing.fishPattern === 'headshake' ? 1.7 : 1;
    fishing.escapeMeter = Math.min(100, fishing.escapeMeter + activeFish.escapeSkill * 18 * panicMultiplier * dt);
  } else {
    fishing.escapeMeter = Math.max(0, fishing.escapeMeter - 13 * dt);
  }

  const danger = Math.max(0, tensionRatio - 0.85);
  const critical = Math.max(0, tensionRatio - 1);
  fishing.lineWear = Math.min(100, fishing.lineWear + (danger * 16 + critical * 42 + (fishing.fishPattern === 'run' ? 2.2 : 0)) * dt);
  if (gPressed) {
    fishing.rodWear = Math.min(100, fishing.rodWear + (danger * 14 + critical * 36 + (fishing.fishPattern === 'deeppull' ? 2.8 : 0)) * dt);
  }
  if (hPressed) {
    fishing.reelWear = Math.min(100, fishing.reelWear + (danger * 15 + critical * 40 + (fishing.fishPattern === 'run' ? 2.5 : 0)) * dt);
    if (!gPressed && fishForce > rodForce + reelForce) {
      fishing.reelWear = Math.min(100, fishing.reelWear + 3.8 * dt);
    }
  }

  fishing.rodOverload = fishing.rodTension;
  fishing.reelOverload = fishing.reelTension;
  fishing.catchProgress = Math.max(0, Math.min(100, (1 - fishing.fishDistance / Math.max(1, fishing.fishStartDistance)) * 100));

  if (fishing.rodTension >= 1 && gPressed) fishing.rodCriticalHold += dt;
  else fishing.rodCriticalHold = Math.max(0, fishing.rodCriticalHold - dt * 1.8);

  if (fishing.reelTension >= 1 && hPressed) fishing.reelCriticalHold += dt;
  else fishing.reelCriticalHold = Math.max(0, fishing.reelCriticalHold - dt * 1.8);

  if (gPressed) fishing.lastPull = 'rod';
  else if (hPressed) fishing.lastPull = 'reel';

  updateFloatPosition();

  if (fishing.lineWear >= 100 || fishing.rodWear >= 100 || fishing.reelWear >= 100) {
    breakCurrentRig();
    setPhase('broken');
    window.setTimeout(() => setPhase('idle'), 1400);
    return;
  }

  const criticalBreakDelay = 2.8;
  if (fishing.rodCriticalHold >= criticalBreakDelay || fishing.reelCriticalHold >= criticalBreakDelay) {
    if (fishing.rodTension >= fishing.reelTension) breakRigPart('rod');
    else breakRigPart('reel');
    setPhase('broken');
    window.setTimeout(() => setPhase('idle'), 1400);
    return;
  }

  if (fishing.escapeMeter >= 100 || fishing.fishDistance >= fishing.fishStartDistance * 1.55) {
    setPhase('escaped');
    window.setTimeout(() => setPhase('idle'), 1200);
    return;
  }

  if (fishing.catchProgress >= 99.5 || fishing.fishDistance <= 1.6) {
    totalFishCaught += 1;
    keepnet.push(activeFish);
    setPhase('landed', activeFish);
    window.setTimeout(() => setPhase('idle'), 1400);
    return;
  }

  renderHudOnly();
}

function renderHudOnly(): void {
  const depthValue = document.querySelector<HTMLDivElement>('.depth-value');
  if (depthValue) depthValue.textContent = `${fishing.currentLoad.toFixed(2)} кг`;

  const rodLoadBar = document.querySelector<HTMLDivElement>('#rod-load-bar');
  const reelLoadBar = document.querySelector<HTMLDivElement>('#reel-load-bar');
  const bobber = document.querySelector<HTMLDivElement>('#bobber');
  const fishMarker = document.querySelector<HTMLDivElement>('#fish-marker');

  if (rodLoadBar) rodLoadBar.style.width = `${Math.max(0, Math.min(100, fishing.rodTension * 100)).toFixed(0)}%`;
  if (reelLoadBar) reelLoadBar.style.width = `${Math.max(0, Math.min(100, fishing.reelTension * 100)).toFixed(0)}%`;

  if (bobber) {
    bobber.style.left = `${fishing.floatX}%`;
    bobber.style.top = `${fishing.floatY}%`;
    bobber.style.setProperty('--bobber-cut', `${fishing.bobberCut.toFixed(2)}`);
  }

  if (fishMarker) {
    const markerPosition = getFishMarkerPosition();
    if (!markerPosition) {
      fishMarker.style.display = 'none';
    } else {
      fishMarker.style.display = 'block';
      fishMarker.style.left = `${markerPosition.x.toFixed(2)}%`;
      fishMarker.style.top = `${markerPosition.y.toFixed(2)}%`;
    }
  }
}

function gameLoop(ts: number): void {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  updateGameClock(dt);
  updateFishing(dt);
  rafId = requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', applyViewportScale);
window.addEventListener('keydown', (event) => {
  if (event.code === 'F8') {
    debugVisible = !debugVisible;
    render();
    return;
  }

  if (event.code === 'KeyG') gPressed = true;
  if (event.code === 'KeyH') hPressed = true;

  if (event.code === 'KeyQ') {
    fishing.dragSetting = Math.max(0.2, fishing.dragSetting - 0.05);
    renderHudOnly();
    return;
  }

  if (event.code === 'KeyE') {
    fishing.dragSetting = Math.min(1, fishing.dragSetting + 0.05);
    renderHudOnly();
    return;
  }

  if (event.code === 'KeyM') {
    screen = screen === 'map' ? 'base' : 'map';
    render();
    return;
  }

  if (event.code === 'Space' && fishing.phase === 'bite') {
    event.preventDefault();
    fishing.catchProgress = 0;
    fishing.fightTimer = 0;
    fishing.rodOverload = 0;
    fishing.reelOverload = 0;
    fishing.fishStamina = 0;
    fishing.fishStaminaMax = 0;
    fishing.fishDistance = 0;
    fishing.fishStartDistance = 0;
    fishing.escapeMeter = 0;
    fishing.lineWear = 0;
    fishing.rodWear = 0;
    fishing.reelWear = 0;
    fishing.fishPattern = fishing.fish?.preferredFightPattern ?? 'struggle';
    fishing.fishPatternTimer = 0;
    fishing.rodCriticalHold = 0;
    fishing.reelCriticalHold = 0;
    setPhase('hooked', fishing.fish ?? undefined);
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyG') gPressed = false;
  if (event.code === 'KeyH') hPressed = false;
});

render();
if (rafId === 0) rafId = requestAnimationFrame(gameLoop);
