import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'kekule/theme';

// 移除骨架屏
const splash = document.getElementById('boot-splash');
if (splash) {
  splash.style.opacity = '0';
  setTimeout(() => splash.remove(), 500);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
