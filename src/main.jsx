import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TerminalApp from './TerminalApp.jsx';
import '../assets/styles.css';

const app = document.querySelector('#app');
const baseUrl = new URL(app.dataset.base, window.location.href);

createRoot(app).render(
  <StrictMode>
    <TerminalApp baseUrl={baseUrl} />
  </StrictMode>,
);
