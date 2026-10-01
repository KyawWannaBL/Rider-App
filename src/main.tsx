import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installNativePhotoRestoreHandler, restorePendingNativePhotoRoute } from './lib/nativePhoto'

const UI_CACHE_VERSION = 'rider-ui-v186-20260930';

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

function applyDeviceCompatibilityClass() {
  try {
    const ua = navigator.userAgent || "";
    const android = /Android/i.test(ua);
    const tabletLike = Math.min(window.innerWidth, window.screen?.width || window.innerWidth) >= 600;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? true;
    const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());

    document.documentElement.classList.toggle("be-android-tablet-compat", android && tabletLike && coarse);
    document.documentElement.classList.toggle("be-native-rider-app", isNative);
    document.documentElement.classList.toggle("be-browser-rider-app", !isNative);
  } catch (error) {
    console.warn("Device compatibility detection skipped:", error);
  }
}

// Restore the exact Pickup Verification route before React Router mounts.
restorePendingNativePhotoRoute();
installNativePhotoRestoreHandler();
applyDeviceCompatibilityClass();
window.addEventListener("resize", applyDeviceCompatibilityClass, { passive: true });
window.addEventListener("orientationchange", applyDeviceCompatibilityClass, { passive: true });

void clearLegacyUiCaches();

createRoot(document.getElementById("root")!).render(<App />);
