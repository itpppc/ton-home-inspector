"use client";
import { Cloud, CloudOff, HardDrive, LoaderCircle, TriangleAlert } from "lucide-react";
import { useSync } from "@/hooks/use-sync";
import { useAuth } from "@/providers/auth-provider";
import { formatDateTime, cn } from "@/lib/utils";

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { mode } = useAuth();
  const s = useSync();
  if (mode === "local") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground" title="ข้อมูลเก็บในเครื่องนี้ (ยังไม่เชื่อม Cloud)">
        <HardDrive className="size-3.5" aria-hidden />
        {!compact && "Local mode"}
      </span>
    );
  }
  const meta = {
    disabled: { icon: CloudOff, text: "ไม่ได้เชื่อมต่อ", cls: "text-muted-foreground" },
    idle: { icon: Cloud, text: s.pending ? `รอส่ง ${s.pending}` : "Sync แล้ว", cls: s.pending ? "text-warning-strong" : "text-success" },
    syncing: { icon: LoaderCircle, text: "กำลัง Sync…", cls: "text-secondary-strong" },
    offline: { icon: CloudOff, text: `ออฟไลน์${s.pending ? ` · รอส่ง ${s.pending}` : ""}`, cls: "text-warning-strong" },
    error: { icon: TriangleAlert, text: "Sync ผิดพลาด", cls: "text-danger" },
  }[s.phase];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => void s.syncNow()}
      className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/70", meta.cls)}
      title={s.lastError ?? (s.lastSyncedAt ? `Sync ล่าสุด ${formatDateTime(s.lastSyncedAt)} · แตะเพื่อ Sync` : "แตะเพื่อ Sync")}
      aria-live="polite"
    >
      <Icon className={cn("size-3.5", s.phase === "syncing" && "animate-spin")} aria-hidden />
      {compact ? <span className="sr-only">{meta.text}</span> : meta.text}
    </button>
  );
}
