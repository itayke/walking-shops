import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { COPY } from '@walking-shops/render/copy.ts';
import { App } from './App.tsx';
import './styles.css';

document.title = COPY.game;
// One device pixel in CSS pixels, so pixel type can snap to whole device pixels and stay crisp at any pixel ratio
document.documentElement.style.setProperty('--device-px', `${1 / (devicePixelRatio || 1)}px`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
