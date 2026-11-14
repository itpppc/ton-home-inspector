"use client";
import { useEffect } from "react";
import { startInstallCapture } from "@/features/pwa/install-state";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    startInstallCapture();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
      // Ask the browser not to evict IndexedDB under storage pressure (important on iOS).
      void navigator.storage?.persist?.().catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
