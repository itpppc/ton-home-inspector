import Dexie, { type EntityTable } from "dexie";
import type { ChecklistCategory, ChecklistItem, Defect, DefectEvent, Photo, PhotoBlob, Project, Property, Room, SyncedTable } from "@/lib/domain/types";
import { uid } from "@/lib/utils";

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
  rooms!: EntityTable<Room, "id">;
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
    // v2 (Phase 2): rooms, room_id, inspection scope, requires_engineer.
    this.version(2)
      .stores({
        rooms: "id, property_id, project_id",
        checklist_items: "id, property_id, category_id, project_id, status, room_id",
        defects: "id, property_id, item_id, project_id, status, severity, room_id",
      })
      .upgrade(async (tx) => {
        const at = new Date().toISOString();
        const items = (await tx.table("checklist_items").toArray()) as ChecklistItem[];
        const roomsByKey = new Map<string, Room>();
        let order = 0;
        for (const it of items) {
          if (!it.location) continue;
          const key = `${it.property_id}|${it.location}`;
          if (!roomsByKey.has(key)) {
            const [floor, ...rest] = it.location.split(" - ");
            const hasFloor = rest.length > 0 && /^ชั้น/.test(floor);
            roomsByKey.set(key, { id: uid(), project_id: it.project_id, property_id: it.property_id, name: hasFloor ? rest.join(" - ") : it.location, floor: hasFloor ? floor : null, sort_order: (order += 10), created_at: at, updated_at: at, deleted_at: null });
          }
        }
        const rooms = [...roomsByKey.values()];
        await tx.table("rooms").bulkPut(rooms);
        const outbox = tx.table("outbox");
        await outbox.bulkPut(rooms.map((r) => ({ key: `rooms:${r.id}`, table: "rooms", row_id: r.id, queued_at: at, attempts: 0, last_error: null })));
        await tx.table("checklist_items").toCollection().modify((it: ChecklistItem) => {
          it.room_id = it.location ? roomsByKey.get(`${it.property_id}|${it.location}`)?.id ?? null : null;
          it.scope ??= "GENERAL";
        });
        await tx.table("defects").toCollection().modify((d: Defect) => {
          d.room_id ??= null;
          d.requires_engineer ??= false;
        });
        const touched = [...(await tx.table("checklist_items").toArray()), ...(await tx.table("defects").toArray())] as (ChecklistItem | Defect)[];
        await outbox.bulkPut(touched.map((r) => ({ key: `${"category_id" in r ? "checklist_items" : "defects"}:${r.id}`, table: "category_id" in r ? "checklist_items" : "defects", row_id: r.id, queued_at: at, attempts: 0, last_error: null })));
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
