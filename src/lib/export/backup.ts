import { getDB } from "@/lib/db/local";
import { notifyMutation } from "@/lib/db/mutations";
import { SYNC_TABLES, type SyncedRow, type SyncedTable } from "@/lib/domain/types";
import { nowIso } from "@/lib/utils";

/**
 * JSON backup / restore. Backups contain EVERY row (including soft-deleted ones, so deletions
 * restore correctly) and optionally the photo files. Restore never overwrites newer data:
 * it applies the same Last-Write-Wins rule as sync, and queues what it wrote for upload.
 */
export const BACKUP_APP = "ton-home-inspector";
export const BACKUP_VERSION = 1;

export interface BackupPhoto { photo_id: string; type: string; data: string }
export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exported_at: string;
  tables: Record<SyncedTable, SyncedRow[]>;
  photos?: BackupPhoto[];
}

export interface RestoreResult {
  applied: number;
  skipped: number;
  photos: number;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function createBackup(opts: { includePhotos: boolean }): Promise<BackupFile> {
  const db = getDB();
  const tables = {} as BackupFile["tables"];
  for (const t of SYNC_TABLES) tables[t] = (await db.table(t).toArray()) as SyncedRow[];
  const file: BackupFile = { app: BACKUP_APP, version: BACKUP_VERSION, exported_at: nowIso(), tables };
  if (opts.includePhotos) {
    const alivePhotoIds = new Set(tables.photos.filter((p) => !p.deleted_at).map((p) => p.id));
    const photos: BackupPhoto[] = [];
    for (const b of await db.photo_blobs.toArray()) {
      if (!alivePhotoIds.has(b.photo_id)) continue;
      photos.push({ photo_id: b.photo_id, type: b.blob.type || "image/jpeg", data: toBase64(new Uint8Array(await b.blob.arrayBuffer())) });
    }
    file.photos = photos;
  }
  return file;
}

export function backupFileName(now = new Date()): string {
  return `ton-home-inspector-backup-${now.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
}

/** Validates the whole file BEFORE anything is written, so a corrupt backup changes nothing. */
export function parseBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== "object") throw new Error("ไฟล์สำรองไม่ถูกต้อง");
  const f = raw as Partial<BackupFile>;
  if (f.app !== BACKUP_APP) throw new Error("ไม่ใช่ไฟล์สำรองของ TON Home Inspector");
  if (f.version !== BACKUP_VERSION) throw new Error(`ไม่รองรับไฟล์สำรองเวอร์ชัน ${String(f.version)}`);
  if (!f.tables || typeof f.tables !== "object") throw new Error("ไฟล์สำรองไม่มีข้อมูล");
  for (const t of SYNC_TABLES) {
    const rows = (f.tables as Record<string, unknown>)[t];
    if (!Array.isArray(rows)) throw new Error(`ไฟล์สำรองขาดตาราง ${t}`);
    for (const r of rows) {
      const row = r as Partial<SyncedRow>;
      if (!row || typeof row.id !== "string" || typeof row.updated_at !== "string") throw new Error(`ข้อมูลในตาราง ${t} ไม่ถูกต้อง`);
    }
  }
  for (const p of f.photos ?? []) {
    if (typeof p?.photo_id !== "string" || typeof p?.data !== "string") throw new Error("ข้อมูลรูปในไฟล์สำรองไม่ถูกต้อง");
  }
  return f as BackupFile;
}

export async function restoreBackup(raw: unknown): Promise<RestoreResult> {
  const file = parseBackup(raw);
  const db = getDB();
  const at = nowIso();
  const result: RestoreResult = { applied: 0, skipped: 0, photos: 0 };
  await db.transaction("rw", [...SYNC_TABLES.map((t) => db.table(t)), db.outbox, db.photo_blobs], async () => {
    for (const table of SYNC_TABLES) {
      const rows = file.tables[table];
      const existing = (await db.table(table).bulkGet(rows.map((r) => r.id))) as (SyncedRow | undefined)[];
      const apply = rows.filter((r, i) => !existing[i] || r.updated_at > existing[i]!.updated_at);
      result.skipped += rows.length - apply.length;
      result.applied += apply.length;
      if (apply.length === 0) continue;
      await db.table(table).bulkPut(apply);
      await db.outbox.bulkPut(apply.map((r) => ({ key: `${table}:${r.id}`, table, row_id: r.id, queued_at: at, attempts: 0, last_error: null })));
    }
    const knownPhotos = new Set(file.tables.photos.filter((p) => !p.deleted_at).map((p) => p.id));
    for (const p of file.photos ?? []) {
      if (!knownPhotos.has(p.photo_id) || (await db.photo_blobs.get(p.photo_id))) continue;
      const bytes = fromBase64(p.data);
      await db.photo_blobs.put({ photo_id: p.photo_id, blob: new Blob([bytes.buffer as ArrayBuffer], { type: p.type }), uploaded: 0 });
      result.photos++;
    }
  });
  notifyMutation();
  return result;
}
