import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorDB, setDB, getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import * as repo from "@/lib/db/repo";
import { createDefect } from "@/lib/db/defects";

let n = 0;
beforeEach(() => setDB(new InspectorDB(`rooms-${++n}`)));

async function setup() {
  await repo.seedDefaultData(null);
  const db = getDB();
  return { db, property: (await db.properties.toArray())[0] };
}

describe("room management", () => {
  it("creates rooms, refusing duplicates, appending at the end", async () => {
    const { db, property } = await setup();
    const room = await repo.createRoom(property, { name: "ห้องนอน 4", floor: "ชั้น 2" });
    const max = Math.max(...(await db.rooms.toArray()).map((r) => r.sort_order));
    expect(room.sort_order).toBe(max);
    await expect(repo.createRoom(property, { name: "ห้องนอน 4", floor: "ชั้น 2" })).rejects.toThrow("มีห้องนี้อยู่แล้ว");
    await repo.createRoom(property, { name: "ห้องนอน 4", floor: "ชั้น 3" }); // different floor = different room
  });

  it("rename refreshes the location snapshot on items and defects and queues them for sync", async () => {
    const { db, property } = await setup();
    const room = await repo.createRoom(property, { name: "ห้องทดสอบ", floor: "ชั้น 1" });
    const cat = (await db.checklist_categories.toArray())[0];
    const item = await repo.createItem(property, { category_id: cat.id, code: "", room_id: room.id, scope: "GENERAL", title: "ในห้อง", description: null, method: null, acceptance_criteria: null, priority: "LOW" });
    const defect = await createDefect({ property, values: { title: "x", description: null, category: null, room_id: room.id, severity: "LOW", requires_engineer: false, recommendation: null, due_date: null }, actor: null });
    await db.outbox.clear();
    await repo.updateRoom(room.id, { name: "ห้องใหม่", floor: "ชั้น 1" });
    expect((await db.checklist_items.get(item.id))!.location).toBe("ชั้น 1 - ห้องใหม่");
    expect((await db.defects.get(defect.id))!.location).toBe("ชั้น 1 - ห้องใหม่");
    const keys = (await db.outbox.toArray()).map((o) => o.key);
    expect(keys).toEqual(expect.arrayContaining([`rooms:${room.id}`, `checklist_items:${item.id}`, `defects:${defect.id}`]));
    await expect(repo.updateRoom(room.id, { name: (await db.rooms.toArray())[0].name, floor: (await db.rooms.toArray())[0].floor })).rejects.toThrow();
  });

  it("delete removes the room's items but keeps its defects (unlinked)", async () => {
    const { db, property } = await setup();
    const room = await repo.createRoom(property, { name: "ห้องลบ", floor: null });
    const cat = (await db.checklist_categories.toArray())[0];
    const item = await repo.createItem(property, { category_id: cat.id, code: "", room_id: room.id, scope: "GENERAL", title: "จะถูกลบ", description: null, method: null, acceptance_criteria: null, priority: "LOW" });
    const defect = await createDefect({ property, values: { title: "หลักฐาน", description: null, category: null, room_id: room.id, severity: "LOW", requires_engineer: false, recommendation: null, due_date: null }, actor: null });
    await repo.deleteRoom(room.id);
    expect((await db.rooms.get(room.id))!.deleted_at).not.toBeNull();
    expect((await db.checklist_items.get(item.id))!.deleted_at).not.toBeNull();
    const kept = (await db.defects.get(defect.id))!;
    expect(alive(kept)).toBe(true);
    expect(kept.room_id).toBeNull();
    expect(kept.location).toBe("ห้องลบ"); // text snapshot preserved for reports
  });

  it("copies a room's items with fresh unique codes and reset status", async () => {
    const { db, property } = await setup();
    const src = (await db.rooms.toArray()).find((r) => r.name.includes("ห้องนอน") && !r.name.includes("ใหญ่"))!;
    const srcItems = await db.checklist_items.filter((i) => i.room_id === src.id && alive(i)).toArray();
    expect(srcItems.length).toBeGreaterThan(0);
    await repo.setItemStatus(srcItems[0].id, "PASS", null);
    const dest = await repo.createRoom(property, { name: "ห้องนอน 4", floor: "ชั้น 2" });
    const copied = await repo.copyRoomItems(src.id, dest.id);
    expect(copied).toBe(srcItems.length);
    const inDest = await db.checklist_items.filter((i) => i.room_id === dest.id).toArray();
    expect(inDest.every((i) => i.status === "NOT_CHECKED" && i.location === "ชั้น 2 - ห้องนอน 4")).toBe(true);
    const codes = (await db.checklist_items.toArray()).map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
    await expect(repo.copyRoomItems(src.id, "nope")).rejects.toThrow();
  });

  it("reorders rooms", async () => {
    const { db } = await setup();
    const before = (await db.rooms.toArray()).sort((a, b) => a.sort_order - b.sort_order);
    await repo.move("rooms", before[1].id, -1);
    const after = (await db.rooms.toArray()).sort((a, b) => a.sort_order - b.sort_order);
    expect(after[0].id).toBe(before[1].id);
    expect(after[1].id).toBe(before[0].id);
  });

  it("migrates v1 text locations to rooms (Dexie v2 upgrade)", async () => {
    const name = `legacy-${++n}`;
    const Dexie = (await import("dexie")).default;
    const v1 = new Dexie(name);
    v1.version(1).stores({ projects: "id", properties: "id", checklist_categories: "id", checklist_items: "id, property_id", defects: "id, property_id", defect_events: "id", photos: "id", photo_blobs: "photo_id, uploaded", outbox: "key, table, queued_at", sync_state: "table", meta: "key" });
    const at = new Date().toISOString();
    await v1.table("checklist_items").bulkPut([
      { id: "i1", project_id: "p", property_id: "pr", category_id: "c", code: "A-001", location: "ชั้น 1 - ห้องนั่งเล่น", title: "t", status: "NOT_CHECKED", created_at: at, updated_at: at, deleted_at: null },
      { id: "i2", project_id: "p", property_id: "pr", category_id: "c", code: "A-002", location: "ชั้น 1 - ห้องนั่งเล่น", title: "t2", status: "NOT_CHECKED", created_at: at, updated_at: at, deleted_at: null },
      { id: "i3", project_id: "p", property_id: "pr", category_id: "c", code: "A-003", location: null, title: "t3", status: "NOT_CHECKED", created_at: at, updated_at: at, deleted_at: null },
    ]);
    v1.close();
    const db = new InspectorDB(name);
    setDB(db);
    const rooms = await db.rooms.toArray();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ floor: "ชั้น 1", name: "ห้องนั่งเล่น" });
    const items = await db.checklist_items.orderBy("id").toArray();
    expect(items.map((i) => i.room_id)).toEqual([rooms[0].id, rooms[0].id, null]);
    expect(items.every((i) => i.scope === "GENERAL")).toBe(true);
    expect(await db.outbox.count()).toBeGreaterThanOrEqual(4); // room + 3 items queued for sync
  });
});
