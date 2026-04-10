import './styles.css';

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('Не найден #app');

appEl.innerHTML = `
  <main class="reset-root">
    <section class="reset-card">
      <p class="reset-badge">Проект перезапущен</p>
      <h1>Игровой прототип удалён</h1>
      <p>
        Старую концепцию полностью убрали. Здесь будет новая игра.
      </p>
    </section>
  </main>
`;
