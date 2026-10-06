import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { routerFuture } from './routerFuture';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

/** Vite's base ("/" locally, "/Sentinel/" on GitHub Pages) without the trailing slash. */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={basename} future={routerFuture}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
