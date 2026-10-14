
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
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
