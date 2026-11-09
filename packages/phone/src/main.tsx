import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { COPY } from '@walking-shops/render/copy.ts';
import { App } from './App.tsx';
import './styles.css';

document.title = COPY.game;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
