import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const UI_CACHE_VERSION = 'rider-ui-v54-20260925';

async function clearLegacyUiCaches() {
  try {
    if (localStorage.getItem('britium.rider.ui-cache-version') === UI_CACHE_VERSION) return;

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    localStorage.setItem('britium.rider.ui-cache-version', UI_CACHE_VERSION);
  } catch (error) {
    console.warn('Legacy Rider UI cache cleanup skipped:', error);
  }
}

void clearLegacyUiCaches();

createRoot(document.getElementById("root")!).render(<App />);
