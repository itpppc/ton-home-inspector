/**
 * PWA install state shared across the app.
 * `beforeinstallprompt` fires once, early, often before any React tree that wants it has mounted,
 * so it is captured at module level (started by ServiceWorkerRegistrar in the root layout).
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type Platform = "ios" | "android" | "desktop";
/** In-app webviews (LINE, Facebook, Instagram…) cannot install PWAs at all. */
export type Browser = "safari" | "chromium" | "samsung" | "firefox" | "in-app" | "other";

export interface Env {
  platform: Platform;
  browser: Browser;
  standalone: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Inline <head> script: holds the event if it fires before React hydrates. */
export const earlyInstallCaptureScript =
  "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__tonBip=e;});";

export function startInstallCapture() {
  type W = Window & { __tonInstall?: boolean; __tonBip?: BeforeInstallPromptEvent };
  if (typeof window === "undefined") return;
  const w = window as W;
  if (w.__tonInstall) return;
  w.__tonInstall = true;
  if (w.__tonBip) {
    deferred = w.__tonBip;
    w.__tonBip = undefined;
    emit();
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const canPrompt = () => deferred !== null;
export const wasInstalled = () => installed;

/** Opens the native install dialog (Chromium/Edge/Samsung). Returns true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // an event can be prompted only once
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}

export function detectEnv(ua: string, opts: { standalone: boolean; maxTouchPoints: number }): Env {
  const isIPadOS = /Macintosh/.test(ua) && opts.maxTouchPoints > 1; // iPadOS 13+ reports desktop Safari
  const platform: Platform = /iPhone|iPad|iPod/.test(ua) || isIPadOS ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
  let browser: Browser = "other";
  if (/\bLine\/|FBAN|FBAV|FB_IAB|Instagram|TikTok|MicroMessenger|; wv\)/i.test(ua)) browser = "in-app";
  else if (/SamsungBrowser/i.test(ua)) browser = "samsung";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "firefox";
  else if (/CriOS|EdgiOS|Chrome|Chromium|Edg\//i.test(ua)) browser = "chromium";
  else if (/Safari/i.test(ua)) browser = "safari";
  return { platform, browser, standalone: opts.standalone };
}

export function currentEnv(): Env {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
  return detectEnv(navigator.userAgent, { standalone, maxTouchPoints: navigator.maxTouchPoints ?? 0 });
}
