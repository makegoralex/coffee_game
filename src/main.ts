import './styles.css';

type Screen = 'base' | 'map' | 'fishing';

interface Rod {
  id: number;
  x: number;
  y: number;
}

const appEl = document.querySelector<HTMLDivElement>('#app');

if (!appEl) {
  throw new Error('Не найден #app');
}

const app = appEl;

let screen: Screen = 'base';
let rods: Rod[] = [];
let rodId = 0;

const MAX_RODS = 3;

function render(): void {
  app.innerHTML = `
    <div class="game-root wood-bg">
      ${renderTopBar()}
      <div class="main-layout">
        <div class="left-stage">
          ${screen === 'base' ? renderBaseScreen() : ''}
          ${screen === 'map' ? renderMapScreen() : ''}
          ${screen === 'fishing' ? renderFishingScreen() : ''}
        </div>
        <aside class="right-sidebar">
          <div class="depth-widget">
            <div class="depth-line"></div>
            <div class="depth-value">6,24 m</div>
          </div>
          <button class="mini-map ${screen !== 'map' ? 'clickable' : ''}" id="open-map-btn" ${screen === 'map' ? 'disabled' : ''}>
            <span>Карта</span>
          </button>
          <button class="base-btn" id="go-base-btn">На базу</button>
          <div class="info-card">
            <h3>Золотая рыбка</h3>
            <p>${screen === 'base' ? 'Рыболовная база' : 'Золотой берег'}</p>
            <a href="#" onclick="return false">Продлить путевку</a>
            <small>Стоимость дня: 135 000 руб.</small>
          </div>
        </aside>
      </div>
      <div class="bottom-panel">
        <div class="status-bars">
          <div class="status-item"><span>еда</span><div class="bar"><i style="height: 28%"></i></div></div>
          <div class="status-item"><span>алк</span><div class="bar"><i style="height: 18%"></i></div></div>
        </div>
        <div class="inventory"></div>
        <div class="chat-area">чат</div>
      </div>
    </div>
  `;

  bindEvents();
}

function renderTopBar(): string {
  return `
    <header class="top-bar">
      <div class="money-box">Время: <b>23:20 СР</b> &nbsp;&nbsp; Деньги: <b>256 418 руб.</b></div>
      <div class="menu-box">Онлайн сервисы | Меню</div>
    </header>
  `;
}

function renderBaseScreen(): string {
  return `
    <section class="screen base-screen">
      <div class="book-panel">
        <div class="book-title">Рыболовная база</div>
        <ul>
          <li>купить снасти</li>
          <li>купить продукты</li>
          <li>дом и автомобиль</li>
          <li>барахолка</li>
          <li>банк</li>
          <li class="map-action">путешествие → нажми карту справа</li>
        </ul>
      </div>
    </section>
  `;
}

function renderMapScreen(): string {
  return `
    <section class="screen map-screen">
      <div class="map-header">Карта водоема <button id="close-map-btn">×</button></div>
      <div class="lake-map" id="lake-map">
        <div class="location-pin active" id="location-gold" style="left: 70%; top: 58%;"></div>
        <div class="location-label">Золотая рыбка</div>
      </div>
    </section>
  `;
}

function renderFishingScreen(): string {
  return `
    <section class="screen fishing-screen">
      <div class="water-overlay" id="water">
        ${rods
          .map(
            (rod) => `
            <div class="rod" style="left:${rod.x}%; top:${rod.y}%">
              <div class="float"></div>
              <div class="line"></div>
              <div class="stick"></div>
            </div>`
          )
          .join('')}
      </div>
      <div class="fishing-help">Клик по воде — закинуть удочку (${rods.length}/${MAX_RODS})</div>
    </section>
  `;
}

function bindEvents(): void {
  const mapBtn = document.querySelector<HTMLButtonElement>('#open-map-btn');
  mapBtn?.addEventListener('click', () => {
    screen = 'map';
    render();
  });

  const baseBtn = document.querySelector<HTMLButtonElement>('#go-base-btn');
  baseBtn?.addEventListener('click', () => {
    screen = 'base';
    rods = [];
    render();
  });

  const closeMapBtn = document.querySelector<HTMLButtonElement>('#close-map-btn');
  closeMapBtn?.addEventListener('click', () => {
    screen = 'base';
    render();
  });

  const goldLocation = document.querySelector<HTMLDivElement>('#location-gold');
  goldLocation?.addEventListener('click', () => {
    screen = 'fishing';
    rods = [];
    render();
  });

  const water = document.querySelector<HTMLDivElement>('#water');
  water?.addEventListener('click', (event) => {
    if (rods.length >= MAX_RODS) {
      return;
    }

    const rect = water.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (y > 82) {
      return;
    }

    rodId += 1;
    rods.push({ id: rodId, x, y });
    render();
  });
}

render();
