import './styles.css';

type Side = 'player' | 'enemy';

interface UnitType {
  key: string;
  name: string;
  emoji: string;
  health: number;
  damage: number;
  speed: number;
  reward: number;
  cost: number;
  cooldown: number;
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
      { key: 'club', name: 'Дубинщик', emoji: '🪵', health: 80, damage: 13, speed: 25, reward: 13, cost: 30, cooldown: 0.9 },
      { key: 'spear', name: 'Копейщик', emoji: '🗡️', health: 120, damage: 18, speed: 19, reward: 20, cost: 55, cooldown: 1.2 },
      { key: 'mammoth', name: 'Мамонт', emoji: '🦣', health: 260, damage: 35, speed: 13, reward: 42, cost: 120, cooldown: 1.8 },
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
      { key: 'sword', name: 'Мечник', emoji: '⚔️', health: 120, damage: 20, speed: 27, reward: 22, cost: 55, cooldown: 0.85 },
      { key: 'crossbow', name: 'Арбалетчик', emoji: '🏹', health: 95, damage: 28, speed: 20, reward: 30, cost: 90, cooldown: 1.35 },
      { key: 'knight', name: 'Рыцарь', emoji: '🐎', health: 320, damage: 44, speed: 15, reward: 58, cost: 185, cooldown: 1.95 },
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
      { key: 'rifle', name: 'Стрелок', emoji: '🔫', health: 145, damage: 31, speed: 29, reward: 33, cost: 85, cooldown: 0.75 },
      { key: 'grenadier', name: 'Гренадёр', emoji: '💣', health: 180, damage: 42, speed: 21, reward: 44, cost: 135, cooldown: 1.2 },
      { key: 'tank', name: 'Танк', emoji: '🚜', health: 430, damage: 66, speed: 12, reward: 78, cost: 265, cooldown: 2.1 },
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
        <li>Сдерживай волну и ломай вражескую базу.</li>
        <li>Переходи в эпоху, чтобы открыть новые юниты.</li>
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

    if (target && bestDist < 3.1) {
      if (unit.cooldownLeft <= 0) {
        target.health -= unit.type.damage;
        unit.cooldownLeft = unit.type.cooldown;
      }
      continue;
    }

    if (distBase < 2.5) {
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
    el.className = `unit ${u.side}`;
    el.style.left = `${u.x}%`;
    const hpPercent = Math.max(0, (u.health / u.type.health) * 100);
    el.innerHTML = `
      <span>${u.type.emoji}</span>
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
    btn.innerHTML = `<span>${idx + 1}. ${u.emoji} ${u.name}</span><strong>${u.cost}</strong>`;
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
