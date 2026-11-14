import type { SyncedRow, SyncedTable, TableRowMap } from "@/lib/domain/types";
import { nowIso, uid } from "@/lib/utils";
import { getDB, type OutboxEntry } from "./local";

type Listener = () => void;
const listeners = new Set<Listener>();
/** Sync engine subscribes to schedule a debounced push after local writes. */
export function onLocalMutation(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((fn) => fn());

function outboxEntry(table: SyncedTable, rowId: string, at: string): OutboxEntry {
  return { key: `${table}:${rowId}`, table, row_id: rowId, queued_at: at, attempts: 0, last_error: null };
}

/**
 * Writes rows and their outbox entries atomically. Every local write goes through here
 * so nothing can be saved without being queued for sync.
 */
export async function writeRows<T extends SyncedTable>(table: T, rows: TableRowMap[T][]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDB();
  const at = nowIso();
  await db.transaction("rw", db.table(table), db.outbox, async () => {
    await db.table(table).bulkPut(rows);
    await db.outbox.bulkPut(rows.map((r) => outboxEntry(table, r.id, at)));
  });
  notify();
}

/** Always assigns a fresh id — callers spreading an existing row can never overwrite it. */
export async function insertRow<T extends SyncedTable>(table: T, row: Omit<TableRowMap[T], keyof SyncedRow> & Partial<SyncedRow>): Promise<TableRowMap[T]> {
  const at = nowIso();
  const full = { ...row, id: uid(), created_at: at, updated_at: at, deleted_at: null } as TableRowMap[T];
  await writeRows(table, [full]);
  return full;
}

export async function patchRow<T extends SyncedTable>(table: T, id: string, patch: Partial<Omit<TableRowMap[T], "id" | "created_at">>): Promise<TableRowMap[T]> {
  const db = getDB();
  const current = (await db.table(table).get(id)) as TableRowMap[T] | undefined;
  if (!current) throw new Error(`ไม่พบข้อมูล (${table}/${id})`);
  const next = { ...current, ...patch, updated_at: nowIso() } as TableRowMap[T];
  await writeRows(table, [next]);
  return next;
}

/** Soft-deletes rows matching ids (keeps them for sync/audit). */
export async function softDelete<T extends SyncedTable>(table: T, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDB();
  const at = nowIso();
  const rows = (await db.table(table).bulkGet(ids)).filter(Boolean) as TableRowMap[T][];
  await writeRows(table, rows.map((r) => ({ ...r, deleted_at: at, updated_at: at })));
}

export const alive = <R extends { deleted_at: string | null }>(r: R) => r.deleted_at === null;
