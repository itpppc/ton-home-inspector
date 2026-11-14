"use client";
import * as React from "react";
import { syncEngine, type SyncSnapshot } from "@/lib/sync/engine";

export function useSync(): SyncSnapshot & { syncNow: () => Promise<void> } {
  const [snap, setSnap] = React.useState<SyncSnapshot>({ phase: "disabled", pending: 0, lastSyncedAt: null, lastError: null });
  React.useEffect(() => syncEngine.subscribe(setSnap), []);
  return { ...snap, syncNow: () => syncEngine.syncNow() };
}

export function useOnline() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
