import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { resetStore } from '@/services/store';

// Expose dev utility on window so it's callable from the browser console
(window as any).resetStore = resetStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
