import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';

// Filter out harmless <Fit /> container adjustment warnings from react-fit
const filterFitWarning = (origFn: (...args: any[]) => void) => {
  return (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes("<Fit />'s child needed to have its")) {
      return;
    }
    origFn(...args);
  };
};
console.warn = filterFitWarning(console.warn);
console.error = filterFitWarning(console.error);

// Sync selected vendor cookie for seamless API routing
try {
  const savedVendor = localStorage.getItem('sipspot_selected_vendor') || 'vnd_sipspot_central';
  document.cookie = `sipspot_vendor_id=${encodeURIComponent(savedVendor)}; path=/; max-age=31536000; SameSite=Lax`;
} catch (e) {}

// Safely intercept fetch to attach X-Vendor-Id header without breaking in browsers where window.fetch is getter-only
try {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    const patchedFetch = function (input: RequestInfo | URL, init?: RequestInit) {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request)?.url || '';
        if (url && (url.startsWith('/api') || url.includes('/api/'))) {
          const selectedVendor = localStorage.getItem('sipspot_selected_vendor');
          if (selectedVendor) {
            const headers = new Headers(init?.headers || {});
            if (!headers.has('X-Vendor-Id')) {
              headers.set('X-Vendor-Id', selectedVendor);
            }
            return originalFetch(input, { ...init, headers });
          }
        }
      } catch {
        // Fall back gracefully
      }
      return originalFetch(input, init);
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: patchedFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // In restricted sandboxes where Object.defineProperty is locked, cookie header serves as fallback
    }
  }
} catch {
  // Non-fatal, application continues
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

