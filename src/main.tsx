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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

