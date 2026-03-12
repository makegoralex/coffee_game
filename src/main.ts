const root = document.createElement('div');
root.style.minHeight = '100vh';
root.style.display = 'flex';
root.style.flexDirection = 'column';
root.style.alignItems = 'center';
root.style.justifyContent = 'center';
root.style.background = '#111';
root.style.color = '#fff';
root.style.fontFamily = 'Arial, sans-serif';
root.innerHTML = `
  <h1>Coffee Ga1me</h1>
  <p>Сайт снова работает.</p>
`;
document.body.innerHTML = '';
document.body.appendChild(root);
