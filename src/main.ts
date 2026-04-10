import './styles.css';

type Side = 'player' | 'enemy';

interface UnitType {
  key: string;
  name: string;
  role: 'melee' | 'ranged' | 'heavy';
  health: number;
  damage: number;
  speed: number;
  reward: number;
  cost: number;
  cooldown: number;
  range: number;
  scale: number;
}

interface Unit {
  id: number;
  side: Side;
  type: UnitType;
  x: number;
  health: number;
  cooldownLeft: number;
}

interface Era {
  key: string;
  title: string;
  description: string;
  units: UnitType[];
  nextEraCost: number;
  playerBase: number;
  enemyBase: number;
  enemyIncome: number;
}

const ERAS: Era[] = [
  {
    key: 'stone',
    title: 'Каменный век',
    description: 'Дубины, шкуры и голодные рейды.',
    nextEraCost: 300,
    playerBase: 520,
    enemyBase: 470,
    enemyIncome: 13,
    units: [
      { key: 'club', name: 'Дубинщик', role: 'melee', health: 105, damage: 14, speed: 23, reward: 14, cost: 32, cooldown: 0.9, range: 3.1, scale: 1 },
      { key: 'spear', name: 'Пращник', role: 'ranged', health: 78, damage: 20, speed: 18, reward: 22, cost: 64, cooldown: 1.25, range: 15, scale: 1 },
      { key: 'mammoth', name: 'Мамонт', role: 'heavy', health: 320, damage: 44, speed: 10, reward: 46, cost: 130, cooldown: 1.95, range: 3.2, scale: 1.2 },
    ],
  },
  {
    key: 'medieval',
    title: 'Средневековье',
    description: 'Сталь, щиты и дисциплина.',
    nextEraCost: 640,
    playerBase: 700,
    enemyBase: 660,
    enemyIncome: 18,
    units: [
      { key: 'sword', name: 'Мечник', role: 'melee', health: 140, damage: 21, speed: 25, reward: 24, cost: 60, cooldown: 0.85, range: 3.2, scale: 1 },
      { key: 'crossbow', name: 'Арбалетчик', role: 'ranged', health: 110, damage: 33, speed: 18, reward: 34, cost: 98, cooldown: 1.3, range: 19, scale: 1 },
      { key: 'knight', name: 'Рыцарь', role: 'heavy', health: 410, damage: 54, speed: 11, reward: 64, cost: 205, cooldown: 2.1, range: 3.3, scale: 1.2 },
    ],
  },
  {
    key: 'industrial',
    title: 'Индустриальная эпоха',
    description: 'Пехота, орудия и механика.',
    nextEraCost: 9999,
    playerBase: 930,
    enemyBase: 920,
    enemyIncome: 24,
    units: [
      { key: 'rifle', name: 'Стрелок', role: 'ranged', health: 130, damage: 38, speed: 20, reward: 38, cost: 96, cooldown: 0.95, range: 23, scale: 1 },
      { key: 'grenadier', name: 'Штурмовик', role: 'melee', health: 210, damage: 34, speed: 22, reward: 48, cost: 140, cooldown: 0.95, range: 3.3, scale: 1.05 },
      { key: 'tank', name: 'Танк', role: 'heavy', health: 560, damage: 78, speed: 8, reward: 85, cost: 290, cooldown: 2.2, range: 6.5, scale: 1.3 },
    ],
  },
];

const FIELD_WIDTH = 100;
const PLAYER_BASE_X = 4;
const ENEMY_BASE_X = 96;

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('Не найден #app');

appEl.innerHTML = `
<main class="game-shell">
  <header class="topbar card">
    <div>
      <p class="label">Веб-адаптация</p>
      <h1>Era Warriors (PC)</h1>
      <p id="eraDescription" class="era-description"></p>
    </div>
    <div class="resources">
      <div><span>🍖 Ресурсы</span><strong id="goldValue">0</strong></div>
      <div><span>📈 Доход/с</span><strong id="incomeValue">0</strong></div>
      <div><span>🏛 Эпоха</span><strong id="eraValue">-</strong></div>
    </div>
  </header>

  <section class="battlefield card">
    <div class="base player-base">
      <p>Твоя база</p>
      <strong id="playerBaseHp">0</strong>
    </div>
    <div class="base enemy-base">
      <p>База врага</p>
      <strong id="enemyBaseHp">0</strong>
    </div>
    <div id="unitsLayer" class="units-layer"></div>
  </section>

  <section class="controls card">
    <div>
      <h2>Найм войск</h2>
      <p class="hint">Нажимай 1 / 2 / 3 для быстрого найма.</p>
      <div id="unitButtons" class="unit-buttons"></div>
    </div>
    <div class="side-panel">
      <button id="ageUpBtn" class="primary">⬆ Перейти в следующую эпоху</button>
      <button id="boostBtn" class="secondary">⚡ Буст дохода (+8/с на 15с)</button>
      <p id="statusText" class="status">Добро пожаловать в бой.</p>
      <ul class="tips">
        <li>Уничтожай врагов, чтобы получать ресурсы.</li>
        <li>Стрелки бьют издалека, но плохо держат удар.</li>
        <li>Сдерживай волну и ломай вражескую базу.</li>
        <li>Тяжёлые бойцы сильнее, но заметно медленнее.</li>
      </ul>
    </div>
  </section>
</main>
`;

const goldEl = document.getElementById('goldValue') as HTMLElement;
const incomeEl = document.getElementById('incomeValue') as HTMLElement;
const eraEl = document.getElementById('eraValue') as HTMLElement;
const playerBaseEl = document.getElementById('playerBaseHp') as HTMLElement;
const enemyBaseEl = document.getElementById('enemyBaseHp') as HTMLElement;
const eraDescriptionEl = document.getElementById('eraDescription') as HTMLElement;
const unitsLayerEl = document.getElementById('unitsLayer') as HTMLElement;
const unitButtonsEl = document.getElementById('unitButtons') as HTMLElement;
const statusTextEl = document.getElementById('statusText') as HTMLElement;
const ageUpBtn = document.getElementById('ageUpBtn') as HTMLButtonElement;
const boostBtn = document.getElementById('boostBtn') as HTMLButtonElement;

let eraIndex = 0;
let gold = 120;
let baseIncome = 16;
let tempIncome = 0;
let incomeBoostTimer = 0;

let playerBaseHp = ERAS[0].playerBase;
let enemyBaseHp = ERAS[0].enemyBase;

const units: Unit[] = [];
let unitId = 0;
let gameOver = false;
let enemySpawnTimer = 0;
let lastTs = performance.now();

function getEra() {
  return ERAS[eraIndex];
}

function updateStatus(text: string) {
  statusTextEl.textContent = text;
}

function spawnUnit(side: Side, type: UnitType) {
  units.push({
    id: unitId++,
    side,
    type,
    x: side === 'player' ? PLAYER_BASE_X : ENEMY_BASE_X,
    health: type.health,
    cooldownLeft: 0,
  });
}

function hire(index: number) {
  if (gameOver) return;
  const type = getEra().units[index];
  if (!type) return;
  if (gold < type.cost) {
    updateStatus(`Недостаточно ресурсов для ${type.name}.`);
    return;
  }
  gold -= type.cost;
  spawnUnit('player', type);
}

function enemyAI(dt: number) {
  const era = getEra();
  enemySpawnTimer -= dt;
  const waveDelay = Math.max(0.7, 2.6 - eraIndex * 0.35);
  if (enemySpawnTimer > 0) return;

  const pick = Math.random();
  const tier = pick < 0.55 ? 0 : pick < 0.85 ? 1 : 2;
  spawnUnit('enemy', era.units[tier]);
  enemySpawnTimer = waveDelay;
}

function updateUnits(dt: number) {
  for (const unit of units) {
    unit.cooldownLeft = Math.max(0, unit.cooldownLeft - dt);
    const dir = unit.side === 'player' ? 1 : -1;
    const enemyUnits = units.filter((u) => u.side !== unit.side);

    let target: Unit | undefined;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const enemy of enemyUnits) {
      const d = Math.abs(enemy.x - unit.x);
      if (d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }

    const baseX = unit.side === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X;
    const distBase = Math.abs(baseX - unit.x);

    if (target && bestDist < unit.type.range) {
      if (unit.cooldownLeft <= 0) {
        target.health -= unit.type.damage;
        unit.cooldownLeft = unit.type.cooldown;
      }
      continue;
    }

    if (distBase < unit.type.range - 0.6) {
      if (unit.cooldownLeft <= 0) {
        if (unit.side === 'player') {
          enemyBaseHp -= unit.type.damage;
        } else {
          playerBaseHp -= unit.type.damage;
        }
        unit.cooldownLeft = unit.type.cooldown;
      }
      continue;
    }

    unit.x += dir * unit.type.speed * dt;
    unit.x = Math.max(0, Math.min(FIELD_WIDTH, unit.x));
  }

  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.health > 0) continue;
    if (u.side === 'enemy') gold += u.type.reward;
    units.splice(i, 1);
  }
}

function renderUnits() {
  unitsLayerEl.innerHTML = '';
  for (const u of units) {
    const el = document.createElement('div');
    el.className = `unit ${u.side} ${u.type.role}`;
    el.style.left = `${u.x}%`;
    el.style.setProperty('--unit-scale', `${u.type.scale}`);
    const hpPercent = Math.max(0, (u.health / u.type.health) * 100);
    el.innerHTML = `
      <span class="model">
        <i class="head"></i>
        <i class="body"></i>
        <i class="weapon"></i>
      </span>
      <small>${u.type.name}</small>
      <b style="--hp:${hpPercent}%"></b>
    `;
    unitsLayerEl.appendChild(el);
  }
}

function renderButtons() {
  unitButtonsEl.innerHTML = '';
  getEra().units.forEach((u, idx) => {
    const btn = document.createElement('button');
    btn.className = 'unit-btn';
    const roleLabel = u.role === 'ranged' ? 'дальн.' : u.role === 'heavy' ? 'тяж.' : 'ближ.';
    btn.innerHTML = `<span>${idx + 1}. ${u.name} <em>${roleLabel}</em></span><strong>${u.cost}</strong>`;
    btn.onclick = () => hire(idx);
    unitButtonsEl.appendChild(btn);
  });
}

function checkEnd() {
  if (gameOver) return;
  if (playerBaseHp <= 0) {
    gameOver = true;
    updateStatus('Поражение. Обнови страницу, чтобы начать заново.');
  } else if (enemyBaseHp <= 0) {
    gameOver = true;
    updateStatus('Победа! Ты разрушил базу врага.');
  }
}

function gameLoop(ts: number) {
  const dt = Math.min(0.04, (ts - lastTs) / 1000);
  lastTs = ts;

  if (!gameOver) {
    const era = getEra();
    gold += (baseIncome + tempIncome + era.enemyIncome * 0.15) * dt;
    if (incomeBoostTimer > 0) {
      incomeBoostTimer -= dt;
      if (incomeBoostTimer <= 0) {
        tempIncome = 0;
        updateStatus('Буст закончился.');
      }
    }

    enemyAI(dt);
    updateUnits(dt);
    checkEnd();
  }

  const era = getEra();
  goldEl.textContent = Math.floor(gold).toString();
  incomeEl.textContent = (baseIncome + tempIncome).toString();
  eraEl.textContent = era.title;
  eraDescriptionEl.textContent = era.description;
  playerBaseEl.textContent = Math.max(0, Math.ceil(playerBaseHp)).toString();
  enemyBaseEl.textContent = Math.max(0, Math.ceil(enemyBaseHp)).toString();

  ageUpBtn.disabled = eraIndex >= ERAS.length - 1 || gold < era.nextEraCost || gameOver;
  ageUpBtn.textContent =
    eraIndex >= ERAS.length - 1
      ? 'Макс. эпоха достигнута'
      : `⬆ Следующая эпоха (${era.nextEraCost})`;

  boostBtn.disabled = incomeBoostTimer > 0 || gold < 90 || gameOver;

  renderUnits();
  requestAnimationFrame(gameLoop);
}

ageUpBtn.onclick = () => {
  const era = getEra();
  if (eraIndex >= ERAS.length - 1) return;
  if (gold < era.nextEraCost) {
    updateStatus('Не хватает ресурсов для перехода эпохи.');
    return;
  }
  gold -= era.nextEraCost;
  eraIndex += 1;
  playerBaseHp = Math.max(playerBaseHp, getEra().playerBase);
  enemyBaseHp = getEra().enemyBase;
  units.length = 0;
  renderButtons();
  updateStatus(`Новая эпоха: ${getEra().title}. Юниты обновлены.`);
};

boostBtn.onclick = () => {
  if (gold < 90 || incomeBoostTimer > 0) return;
  gold -= 90;
  tempIncome = 8;
  incomeBoostTimer = 15;
  updateStatus('Буст дохода активирован на 15 секунд.');
};

window.addEventListener('keydown', (e) => {
  if (e.key === '1' || e.key === '2' || e.key === '3') {
    hire(Number(e.key) - 1);
  }
});

renderButtons();
requestAnimationFrame(gameLoop);
