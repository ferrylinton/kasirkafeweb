import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';
import { getDeviceMetadata } from './utils/deviceFingerprint';

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
  const savedVendor = localStorage.getItem('kasirkafe_selected_vendor') || 'vnd_kasirkafe_central';
  document.cookie = `kasirkafe_vendor_id=${encodeURIComponent(savedVendor)}; path=/; max-age=31536000; SameSite=Lax`;
} catch (e) {}

// Safely intercept fetch to attach headers and trigger DB connection error alerts
try {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    const patchedFetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      let finalInit = init;
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request)?.url || '';
        if (url && (url.startsWith('/api') || url.includes('/api/'))) {
          const headers = new Headers(init?.headers || {});
          
          const selectedVendor = localStorage.getItem('kasirkafe_selected_vendor');
          if (selectedVendor && !headers.has('X-Vendor-Id')) {
            headers.set('X-Vendor-Id', selectedVendor);
          }

          const metadata = getDeviceMetadata();
          if (!headers.has('X-Device-Fingerprint')) {
            headers.set('X-Device-Fingerprint', metadata.fingerprint);
          }
          if (!headers.has('X-Device-Id')) {
            headers.set('X-Device-Id', metadata.deviceId);
          }

          finalInit = { ...init, headers };
        }
      } catch {
        // Fall back gracefully
      }

      try {
        const response = await originalFetch(input, finalInit);

        // If backend reports database unavailable (503), trigger alert modal
        if (response.status === 503) {
          try {
            const clone = response.clone();
            const data = await clone.json();
            const msg = data?.message || data?.error || 'can not connect to db';
            window.dispatchEvent(
              new CustomEvent('kasirkafe:db-error', {
                detail: { message: msg }
              })
            );
          } catch {
            window.dispatchEvent(
              new CustomEvent('kasirkafe:db-error', {
                detail: { message: 'can not connect to db' }
              })
            );
          }
        }

        return response;
      } catch (err) {
        throw err;
      }
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: patchedFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // In restricted sandboxes where Object.defineProperty is locked, fallback
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

