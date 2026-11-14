import type { ChecklistCategory, ChecklistItem, ItemStatus, Project, Property, Room } from "@/lib/domain/types";
import type { ChecklistItemValues, ProjectValues, PropertyValues, RoomValues } from "@/lib/domain/schemas";
import { buildChecklist } from "@/lib/seed/build";
import { DEFAULT_PROJECT, DEFAULT_PROPERTY, roomLabel } from "@/lib/seed/checklist-template";
import { nowIso, uid } from "@/lib/utils";
import { getDB, getMeta, setMeta } from "./local";
import { alive, insertRow, patchRow, softDelete, writeRows } from "./mutations";

/* ───────────── Projects ───────────── */

export function createProject(values: ProjectValues, ownerId: string | null) {
  return insertRow("projects", { ...values, owner_id: ownerId });
}

export function updateProject(id: string, values: ProjectValues) {
  return patchRow("projects", id, values);
}

/** Soft-deletes a project and everything beneath it. */
export async function deleteProject(id: string) {
  const db = getDB();
  const propertyIds = (await db.properties.where("project_id").equals(id).filter(alive).toArray()).map((p) => p.id);
  for (const pid of propertyIds) await deleteProperty(pid);
  await softDelete("projects", [id]);
}

/* ───────────── Properties ───────────── */

export async function createProperty(projectId: string, values: PropertyValues, opts: { withTemplate: boolean }) {
  const property = await insertRow("properties", { ...values, project_id: projectId });
  if (opts.withTemplate) await applyTemplate(projectId, property.id);
  return property;
}

export function updateProperty(id: string, values: Partial<PropertyValues>) {
  return patchRow("properties", id, values);
}

export async function deleteProperty(id: string) {
  const db = getDB();
  const [rooms, cats, items, defects] = await Promise.all([
    db.rooms.where("property_id").equals(id).filter(alive).primaryKeys(),
    db.checklist_categories.where("property_id").equals(id).filter(alive).primaryKeys(),
    db.checklist_items.where("property_id").equals(id).filter(alive).primaryKeys(),
    db.defects.where("property_id").equals(id).filter(alive).primaryKeys(),
  ]);
  await softDelete("defects", defects);
  await softDelete("checklist_items", items);
  await softDelete("checklist_categories", cats);
  await softDelete("rooms", rooms);
  await softDelete("properties", [id]);
}

export async function applyTemplate(projectId: string, propertyId: string) {
  const existingRooms = await getDB().rooms.where("property_id").equals(propertyId).filter(alive).toArray();
  const { rooms, categories, items } = buildChecklist(projectId, propertyId, nowIso(), undefined, existingRooms);
  await writeRows("rooms", rooms);
  await writeRows("checklist_categories", categories);
  await writeRows("checklist_items", items);
  return { rooms: rooms.length, categories: categories.length, items: items.length };
}

/** Copies another property's rooms + checklist structure (statuses reset). */
export async function copyChecklist(fromPropertyId: string, to: Pick<Property, "id" | "project_id">) {
  const db = getDB();
  const at = nowIso();
  const base = { project_id: to.project_id, property_id: to.id, created_at: at, updated_at: at };
  const [srcRooms, destRooms, cats, items] = await Promise.all([
    db.rooms.where("property_id").equals(fromPropertyId).filter(alive).toArray(),
    db.rooms.where("property_id").equals(to.id).filter(alive).toArray(),
    db.checklist_categories.where("property_id").equals(fromPropertyId).filter(alive).toArray(),
    db.checklist_items.where("property_id").equals(fromPropertyId).filter(alive).toArray(),
  ]);
  const destByLabel = new Map(destRooms.map((r) => [roomLabel(r), r.id]));
  const roomMap = new Map<string, string>();
  const newRooms: Room[] = [];
  for (const r of srcRooms.sort((a, b) => a.sort_order - b.sort_order)) {
    const existing = destByLabel.get(roomLabel(r));
    if (existing) roomMap.set(r.id, existing);
    else {
      const room = { ...r, ...base, id: uid() };
      newRooms.push(room);
      roomMap.set(r.id, room.id);
    }
  }
  const catMap = new Map<string, string>();
  const newCats: ChecklistCategory[] = cats.sort((a, b) => a.sort_order - b.sort_order).map((c) => {
    const id = uid();
    catMap.set(c.id, id);
    return { ...c, ...base, id };
  });
  const newItems: ChecklistItem[] = items
    .filter((i) => catMap.has(i.category_id))
    .map((i) => ({ ...i, ...base, id: uid(), category_id: catMap.get(i.category_id)!, room_id: i.room_id ? roomMap.get(i.room_id) ?? null : null, status: "NOT_CHECKED", note: null, checked_at: null, checked_by: null }));
  await writeRows("rooms", newRooms);
  await writeRows("checklist_categories", newCats);
  await writeRows("checklist_items", newItems);
}

/* ───────────── Rooms ───────────── */

export async function createRoom(property: Pick<Property, "id" | "project_id">, values: RoomValues) {
  const siblings = await getDB().rooms.where("property_id").equals(property.id).filter(alive).toArray();
  if (siblings.some((r) => roomLabel(r) === roomLabel(values))) throw new Error("มีห้องนี้อยู่แล้ว");
  const max = siblings.reduce((m, r) => Math.max(m, r.sort_order), 0);
  return insertRow("rooms", { project_id: property.project_id, property_id: property.id, name: values.name, floor: values.floor, sort_order: max + 10 });
}

/** Renames a room and refreshes the location snapshot on its items and defects. */
export async function updateRoom(id: string, values: RoomValues) {
  const db = getDB();
  const room = await db.rooms.get(id);
  if (!room) throw new Error("ไม่พบห้อง");
  const siblings = await db.rooms.where("property_id").equals(room.property_id).filter((r) => alive(r) && r.id !== id).toArray();
  if (siblings.some((r) => roomLabel(r) === roomLabel(values))) throw new Error("มีห้องนี้อยู่แล้ว");
  const updated = await patchRow("rooms", id, { name: values.name, floor: values.floor });
  const label = roomLabel(updated);
  const at = nowIso();
  const items = await db.checklist_items.filter((i) => i.room_id === id && alive(i) && i.location !== label).toArray();
  const defects = await db.defects.filter((d) => d.room_id === id && alive(d) && d.location !== label).toArray();
  await writeRows("checklist_items", items.map((i) => ({ ...i, location: label, updated_at: at })));
  await writeRows("defects", defects.map((d) => ({ ...d, location: label, updated_at: at })));
  return updated;
}

/**
 * Deletes a room that does not exist in this house: its checklist items go with it,
 * defects are kept (unlinked) because they are evidence.
 */
export async function deleteRoom(id: string) {
  const db = getDB();
  const at = nowIso();
  const items = await db.checklist_items.filter((i) => i.room_id === id && alive(i)).primaryKeys();
  const defects = await db.defects.filter((d) => d.room_id === id && alive(d)).toArray();
  await softDelete("checklist_items", items);
  await writeRows("defects", defects.map((d) => ({ ...d, room_id: null, updated_at: at })));
  await softDelete("rooms", [id]);
}

/** Duplicates the checklist items of one room into another room (e.g. a 4th bedroom). */
export async function copyRoomItems(fromRoomId: string, toRoomId: string) {
  const db = getDB();
  const [from, to] = await Promise.all([db.rooms.get(fromRoomId), db.rooms.get(toRoomId)]);
  if (!from || !to || from.property_id !== to.property_id) throw new Error("ห้องไม่ถูกต้อง");
  const at = nowIso();
  const label = roomLabel(to);
  const src = await db.checklist_items.filter((i) => i.room_id === fromRoomId && alive(i)).toArray();
  const all = await db.checklist_items.where("property_id").equals(to.property_id).filter(alive).toArray();
  const nextNum = new Map<string, number>();
  for (const i of all) {
    const [prefix, num] = i.code.split("-");
    if (prefix && Number(num)) nextNum.set(prefix, Math.max(nextNum.get(prefix) ?? 0, Number(num)));
  }
  const maxOrder = new Map<string, number>();
  for (const i of all) maxOrder.set(i.category_id, Math.max(maxOrder.get(i.category_id) ?? 0, i.sort_order));
  const copies: ChecklistItem[] = src.map((i) => {
    const prefix = i.code.split("-")[0] || "ITEM";
    const n = (nextNum.get(prefix) ?? 0) + 1;
    nextNum.set(prefix, n);
    const order = (maxOrder.get(i.category_id) ?? 0) + 10;
    maxOrder.set(i.category_id, order);
    return { ...i, id: uid(), room_id: to.id, location: label, code: `${prefix}-${String(n).padStart(3, "0")}`, sort_order: order, status: "NOT_CHECKED", note: null, checked_at: null, checked_by: null, created_at: at, updated_at: at, deleted_at: null };
  });
  await writeRows("checklist_items", copies);
  return copies.length;
}

async function roomSnapshot(roomId: string | null, propertyId: string): Promise<string | null> {
  if (!roomId) return null;
  const room = await getDB().rooms.get(roomId);
  if (!room || !alive(room) || room.property_id !== propertyId) throw new Error("ห้องไม่ถูกต้อง");
  return roomLabel(room);
}

/* ───────────── Checklist ───────────── */

export async function createCategory(property: Pick<Property, "id" | "project_id">, name: string) {
  const db = getDB();
  const siblings = await db.checklist_categories.where("property_id").equals(property.id).filter(alive).toArray();
  const max = siblings.reduce((m, c) => Math.max(m, c.sort_order), 0);
  return insertRow("checklist_categories", { project_id: property.project_id, property_id: property.id, name: name.trim(), sort_order: max + 10 });
}

export const renameCategory = (id: string, name: string) => patchRow("checklist_categories", id, { name: name.trim() });

export async function deleteCategory(id: string) {
  const items = await getDB().checklist_items.where("category_id").equals(id).filter(alive).primaryKeys();
  await softDelete("checklist_items", items);
  await softDelete("checklist_categories", [id]);
}

function categoryPrefix(name: string, existing: ChecklistItem[]): string {
  const fromExisting = existing.find((i) => /^[A-Z]+-\d+$/.test(i.code))?.code.split("-")[0];
  return fromExisting ?? (name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "ITEM");
}

export async function createItem(property: Pick<Property, "id" | "project_id">, values: ChecklistItemValues) {
  const db = getDB();
  const category = await db.checklist_categories.get(values.category_id);
  if (!category || category.property_id !== property.id) throw new Error("หมวดไม่ถูกต้อง");
  const siblings = await db.checklist_items.where("category_id").equals(values.category_id).filter(alive).toArray();
  const maxOrder = siblings.reduce((m, i) => Math.max(m, i.sort_order), 0);
  const prefix = categoryPrefix(category.name, siblings);
  const maxNum = siblings.reduce((m, i) => Math.max(m, Number(i.code.split("-")[1]) || 0), 0);
  const location = await roomSnapshot(values.room_id, property.id);
  return insertRow("checklist_items", {
    ...values,
    location,
    code: values.code || `${prefix}-${String(maxNum + 1).padStart(3, "0")}`,
    project_id: property.project_id,
    property_id: property.id,
    sort_order: maxOrder + 10,
    status: "NOT_CHECKED",
    note: null,
    checked_at: null,
    checked_by: null,
  });
}

export async function updateItem(id: string, values: ChecklistItemValues) {
  const current = await getDB().checklist_items.get(id);
  if (!current) throw new Error("ไม่พบรายการ");
  const location = await roomSnapshot(values.room_id, current.property_id);
  // Moving category → append at the end of the new category.
  if (current.category_id !== values.category_id) {
    const siblings = await getDB().checklist_items.where("category_id").equals(values.category_id).filter(alive).toArray();
    const maxOrder = siblings.reduce((m, i) => Math.max(m, i.sort_order), 0);
    return patchRow("checklist_items", id, { ...values, location, code: values.code || current.code, sort_order: maxOrder + 10 });
  }
  return patchRow("checklist_items", id, { ...values, location, code: values.code || current.code });
}

export const deleteItem = (id: string) => softDelete("checklist_items", [id]);

export function setItemStatus(id: string, status: ItemStatus, userId: string | null) {
  const checked = status !== "NOT_CHECKED";
  return patchRow("checklist_items", id, { status, checked_at: checked ? nowIso() : null, checked_by: checked ? userId : null });
}

export const setItemNote = (id: string, note: string) => patchRow("checklist_items", id, { note: note.trim() || null });

/** Swap sort order with the neighbour in the given direction. Works for items and categories. */
export async function move(table: "checklist_items" | "checklist_categories" | "rooms", id: string, dir: -1 | 1) {
  const db = getDB();
  const row = (await db.table(table).get(id)) as ChecklistItem | ChecklistCategory | Room | undefined;
  if (!row) return;
  const siblings = (table === "checklist_items"
    ? await db.checklist_items.where("category_id").equals((row as ChecklistItem).category_id).filter(alive).toArray()
    : await db.table(table).where("property_id").equals(row.property_id).filter(alive).toArray() as (ChecklistCategory | Room)[]
  ).sort((a, b) => a.sort_order - b.sort_order);
  const idx = siblings.findIndex((s) => s.id === id);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= siblings.length) return;
  // Normalise to 10,20,30… then swap — robust against duplicate sort_order values.
  const reordered = siblings.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 }));
  [reordered[idx].sort_order, reordered[j].sort_order] = [reordered[j].sort_order, reordered[idx].sort_order];
  const at = nowIso();
  const changed = reordered.filter((r, i) => r.sort_order !== siblings[i].sort_order).map((r) => ({ ...r, updated_at: at }));
  await writeRows(table, changed as never[]);
}

/* ───────────── Seed ───────────── */

/** Creates the Siri Place Rama 2 · TH99B pilot project + house with the standard checklist, and selects it. */
export async function createPilotHouse(ownerId: string | null) {
  const project = await createProject({ ...DEFAULT_PROJECT, inspection_date: null, reinspection_date: null }, ownerId);
  const property = await createProperty(project.id, { ...DEFAULT_PROPERTY }, { withTemplate: true });
  await setMeta("currentPropertyId", property.id);
  return { project, property };
}

/**
 * Seeds the default project/property once per owner. Seeding is skipped when the
 * owner already has any project (e.g. pulled from another device).
 */
export async function seedDefaultData(ownerId: string | null): Promise<boolean> {
  const db = getDB();
  const flag = `seeded:${ownerId ?? "local"}`;
  if (await getMeta<boolean>(flag)) return false;
  const hasProjects = (await db.projects.filter(alive).count()) > 0;
  if (!hasProjects) await createPilotHouse(ownerId);
  await setMeta(flag, true);
  return !hasProjects;
}

export type { Project, Property };
