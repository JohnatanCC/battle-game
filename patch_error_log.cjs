const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = `
window.addEventListener('error', (e) => {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.left = '0';
  div.style.color = 'red';
  div.style.backgroundColor = 'black';
  div.style.zIndex = '999999';
  div.style.fontSize = '20px';
  div.style.padding = '10px';
  div.textContent = e.error ? e.error.stack : e.message;
  document.body.appendChild(div);
});
` + code;

fs.writeFileSync('src/main.tsx', code);
