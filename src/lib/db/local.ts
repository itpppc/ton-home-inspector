import Dexie, { type EntityTable } from "dexie";
import type { ChecklistCategory, ChecklistItem, Defect, DefectEvent, Photo, PhotoBlob, Project, Property, SyncedTable } from "@/lib/domain/types";

export interface OutboxEntry {
  key: string; // `${table}:${row_id}` — one entry per row, latest state is read at push time
  table: SyncedTable;
  row_id: string;
  queued_at: string;
  attempts: number;
  last_error: string | null;
}

export interface SyncCursor {
  table: SyncedTable;
  cursor: string | null; // max server_updated_at pulled
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class InspectorDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  properties!: EntityTable<Property, "id">;
  checklist_categories!: EntityTable<ChecklistCategory, "id">;
  checklist_items!: EntityTable<ChecklistItem, "id">;
  defects!: EntityTable<Defect, "id">;
  defect_events!: EntityTable<DefectEvent, "id">;
  photos!: EntityTable<Photo, "id">;
  photo_blobs!: EntityTable<PhotoBlob, "photo_id">;
  outbox!: EntityTable<OutboxEntry, "key">;
  sync_state!: EntityTable<SyncCursor, "table">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name = "ton-home-inspector") {
    super(name);
    this.version(1).stores({
      projects: "id, updated_at",
      properties: "id, project_id, updated_at",
      checklist_categories: "id, property_id, project_id",
      checklist_items: "id, property_id, category_id, project_id, status",
      defects: "id, property_id, item_id, project_id, status, severity",
      defect_events: "id, defect_id, project_id",
      photos: "id, property_id, defect_id, item_id, project_id",
      photo_blobs: "photo_id, uploaded",
      outbox: "key, table, queued_at",
      sync_state: "table",
      meta: "key",
    });
  }
}

let instance: InspectorDB | null = null;
export function getDB(): InspectorDB {
  instance ??= new InspectorDB();
  return instance;
}
/** Test hook: swap in an isolated database. */
export function setDB(db: InspectorDB | null) {
  instance = db;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await getDB().meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await getDB().meta.put({ key, value });
}
