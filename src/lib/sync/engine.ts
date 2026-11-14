"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyServerError } from "@/features/plans/plans";
import { SYNC_TABLES, type Photo, type SyncedRow, type SyncedTable } from "@/lib/domain/types";
import { PHOTO_BUCKET } from "@/lib/supabase/config";
import { getDB, type OutboxEntry } from "@/lib/db/local";
import { onLocalMutation } from "@/lib/db/mutations";

export type SyncPhase = "disabled" | "idle" | "syncing" | "offline" | "error";

export interface SyncSnapshot {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

const PAGE = 1000;
const PUSH_CHUNK = 200;
const LOCAL_ONLY_FIELDS = new Set(["server_updated_at"]);

/** Remote → local merge rule (Last-Write-Wins), exported for unit tests. */
export function shouldApplyRemote(local: Pick<SyncedRow, "updated_at"> | undefined, remote: Pick<SyncedRow, "updated_at">, hasPendingLocal: boolean): boolean {
  if (!local) return true;
  if (!hasPendingLocal) return true; // nothing unsynced locally: server state wins
  return remote.updated_at > local.updated_at;
}

function toRemote(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!LOCAL_ONLY_FIELDS.has(k)) out[k] = v;
  return out;
}

/**
 * Uploads the on-device JPEG of each photo to private Storage BEFORE its row is pushed, so a synced
 * row never points at a missing file. Returns the ids whose upload failed (row stays queued, blob stays local).
 * Soft-deleted photos skip the upload — their binary is no longer needed on this device either.
 */
export async function uploadPhotoBlobs(client: Pick<SupabaseClient, "storage">, photos: Photo[]): Promise<{ failed: Map<string, string> }> {
  const db = getDB();
  const failed = new Map<string, string>();
  for (const photo of photos) {
    const local = await db.photo_blobs.get(photo.id);
    if (photo.deleted_at) {
      if (local) await db.photo_blobs.delete(photo.id);
      continue;
    }
    if (!local || local.uploaded === 1) continue; // already in Storage, or authored on another device
    if (!photo.storage_path) {
      failed.set(photo.id, "ไม่มี storage_path");
      continue;
    }
    const { error } = await client.storage.from(PHOTO_BUCKET).upload(photo.storage_path, local.blob, { contentType: "image/jpeg", upsert: true });
    if (error) failed.set(photo.id, error.message);
    else await db.photo_blobs.update(photo.id, { uploaded: 1 });
  }
  return { failed };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

export class SyncEngine {
  private snapshot: SyncSnapshot = { phase: "disabled", pending: 0, lastSyncedAt: null, lastError: null };
  private listeners = new Set<(s: SyncSnapshot) => void>();
  private running: Promise<void> | null = null;
  private rerun = false;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private teardown: (() => void)[] = [];
  private client: SupabaseClient | null = null;
  private userId: string | null = null;
  private onFirstPull: (() => Promise<void>) | null = null;

  subscribe(fn: (s: SyncSnapshot) => void) {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => void this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn(this.snapshot));
  }

  async refreshPending() {
    this.set({ pending: await getDB().outbox.count() });
  }

  /** Starts background sync for an authenticated user. */
  start(client: SupabaseClient, userId: string, onFirstPull?: () => Promise<void>) {
    this.stop();
    this.client = client;
    this.userId = userId;
    this.onFirstPull = onFirstPull ?? null;
    this.set({ phase: "idle", lastError: null });
    const onOnline = () => void this.syncNow();
    const onVisible = () => document.visibilityState === "visible" && void this.syncNow();
    const onSwMessage = (e: MessageEvent) => e.data === "SYNC_REQUESTED" && void this.syncNow();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    const offMutation = onLocalMutation(() => {
      void this.refreshPending();
      this.schedule(2000);
    });
    this.interval = setInterval(() => void this.syncNow(), 60_000);
    this.teardown = [
      () => window.removeEventListener("online", onOnline),
      () => document.removeEventListener("visibilitychange", onVisible),
      () => navigator.serviceWorker?.removeEventListener("message", onSwMessage),
      () => void offMutation(),
    ];
    void this.syncNow();
  }

  /** Local mode: only track pending count. */
  startLocal() {
    this.stop();
    this.set({ phase: "disabled" });
    const off = onLocalMutation(() => void this.refreshPending());
    this.teardown = [() => void off()];
    void this.refreshPending();
  }

  stop() {
    this.teardown.forEach((fn) => fn());
    this.teardown = [];
    if (this.interval) clearInterval(this.interval);
    if (this.debounce) clearTimeout(this.debounce);
    this.interval = this.debounce = null;
    this.client = null;
    this.userId = null;
  }

  schedule(ms: number) {
    if (!this.client) return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.syncNow(), ms);
  }

  /** Coalesces concurrent calls: at most one run plus one queued re-run. */
  syncNow(): Promise<void> {
    if (!this.client) return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.rerun) {
        this.rerun = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  private async run() {
    const client = this.client;
    if (!client) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.set({ phase: "offline" });
      return;
    }
    this.set({ phase: "syncing" });
    try {
      const pushErrors = await this.push(client);
      const db = getDB();
      const firstPull = !(await db.meta.get(`pulled:${this.userId}`));
      await this.pull(client);
      if (firstPull) {
        await db.meta.put({ key: `pulled:${this.userId}`, value: true });
        await this.onFirstPull?.();
        if ((await db.outbox.count()) > 0) await this.push(client);
      }
      await this.refreshPending();
      this.set({ phase: pushErrors ? "error" : "idle", lastSyncedAt: new Date().toISOString(), lastError: pushErrors });
      if (!pushErrors) this.registerBackgroundSync();
    } catch (e) {
      await this.refreshPending();
      this.set({ phase: navigator.onLine ? "error" : "offline", lastError: errMsg(e) });
    }
  }

  /** Returns a summary error string if some rows failed, null if all succeeded. */
  private async push(client: SupabaseClient): Promise<string | null> {
    const db = getDB();
    const entries = await db.outbox.toArray();
    if (entries.length === 0) return null;
    const failures: string[] = [];

    for (const table of SYNC_TABLES) {
      const forTable = entries.filter((e) => e.table === table).sort((a, b) => a.queued_at.localeCompare(b.queued_at));
      for (let i = 0; i < forTable.length; i += PUSH_CHUNK) {
        const chunk = forTable.slice(i, i + PUSH_CHUNK);
        const rows = (await db.table(table).bulkGet(chunk.map((c) => c.row_id))) as (Record<string, unknown> | undefined)[];
        let present = chunk.map((entry, k) => ({ entry, row: rows[k] })).filter((x): x is { entry: OutboxEntry; row: Record<string, unknown> } => !!x.row);
        const orphans = chunk.filter((_, k) => !rows[k]);
        if (orphans.length) await db.outbox.bulkDelete(orphans.map((o) => o.key));
        if (table === "photos" && present.length > 0) {
          const { failed } = await uploadPhotoBlobs(client, present.map((p) => p.row as unknown as Photo));
          for (const p of present) {
            const reason = failed.get(p.row.id as string);
            if (!reason) continue;
            failures.push(`photos (อัปโหลดรูป): ${reason}`);
            await db.outbox.update(p.entry.key, { attempts: p.entry.attempts + 1, last_error: reason });
          }
          present = present.filter((p) => !failed.has(p.row.id as string));
        }
        if (present.length === 0) continue;

        const { error } = await client.from(table).upsert(present.map((p) => toRemote(p.row)), { onConflict: "id" });
        if (!error) {
          await this.ack(present.map((p) => p.entry));
          continue;
        }
        // Batch failed: isolate bad rows so one invalid row never blocks the queue.
        for (const p of present) {
          const single = await client.from(table).upsert(toRemote(p.row), { onConflict: "id" });
          if (single.error) {
            const msg = friendlyServerError(single.error.message);
            failures.push(`${table}: ${msg}`);
            await db.outbox.update(p.entry.key, { attempts: p.entry.attempts + 1, last_error: msg });
          } else {
            await this.ack([p.entry]);
          }
        }
      }
    }
    return failures.length ? `ส่งข้อมูลไม่สำเร็จ ${failures.length} รายการ: ${failures[0]}` : null;
  }

  /** Removes outbox entries only if the row was not edited again while pushing. */
  private async ack(entries: OutboxEntry[]) {
    const db = getDB();
    await db.transaction("rw", db.outbox, async () => {
      for (const e of entries) {
        const current = await db.outbox.get(e.key);
        if (current && current.queued_at === e.queued_at) await db.outbox.delete(e.key);
      }
    });
  }

  private async pull(client: SupabaseClient) {
    const db = getDB();
    for (const table of SYNC_TABLES) {
      let cursor = (await db.sync_state.get(table))?.cursor ?? null;
      for (;;) {
        let q = client.from(table).select("*").order("server_updated_at", { ascending: true }).limit(PAGE);
        if (cursor) q = q.gt("server_updated_at", cursor);
        const { data, error } = await q;
        if (error) throw new Error(`${table}: ${error.message}`);
        const rows = (data ?? []) as (SyncedRow & { server_updated_at: string })[];
        if (rows.length === 0) break;
        await this.merge(table, rows);
        cursor = rows[rows.length - 1].server_updated_at;
        await db.sync_state.put({ table, cursor });
        if (rows.length < PAGE) break;
      }
    }
  }

  private async merge(table: SyncedTable, remote: (SyncedRow & { server_updated_at: string })[]) {
    const db = getDB();
    await db.transaction("rw", db.table(table), db.outbox, async () => {
      const ids = remote.map((r) => r.id);
      const locals = (await db.table(table).bulkGet(ids)) as (SyncedRow | undefined)[];
      const pending = new Set((await db.outbox.bulkGet(ids.map((id) => `${table}:${id}`))).filter(Boolean).map((e) => e!.row_id));
      const apply = remote.filter((r, i) => shouldApplyRemote(locals[i], r, pending.has(r.id)));
      if (apply.length) await db.table(table).bulkPut(apply);
      // Remote is newer than a pending local edit: drop the stale outbox entry.
      const superseded = apply.filter((r) => pending.has(r.id)).map((r) => `${table}:${r.id}`);
      if (superseded.length) await db.outbox.bulkDelete(superseded);
    });
  }

  private registerBackgroundSync() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready
      .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register("ton-sync"))
      .catch(() => undefined);
  }
}

export const syncEngine = new SyncEngine();
