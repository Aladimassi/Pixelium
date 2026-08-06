import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootEl = document.getElementById('root');

function showBootError(message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `<div class="app-boot-fallback app-boot-fallback--error" role="alert">${message}</div>`;
}

if (!rootEl) {
  throw new Error('Missing #root element');
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  const message = err instanceof Error ? err.message : 'Failed to start the store UI';
  showBootError(`Unable to load Pixelium Store. ${message}`);
  console.error(err);
}
