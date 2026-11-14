import type { ChecklistCategory, ChecklistItem, ItemStatus, Project, Property } from "@/lib/domain/types";
import type { ChecklistItemValues, ProjectValues, PropertyValues } from "@/lib/domain/schemas";
import { buildChecklist } from "@/lib/seed/build";
import { DEFAULT_PROJECT, DEFAULT_PROPERTY } from "@/lib/seed/checklist-template";
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
  const [cats, items] = await Promise.all([
    db.checklist_categories.where("property_id").equals(id).filter(alive).primaryKeys(),
    db.checklist_items.where("property_id").equals(id).filter(alive).primaryKeys(),
  ]);
  await softDelete("checklist_items", items);
  await softDelete("checklist_categories", cats);
  await softDelete("properties", [id]);
}

export async function applyTemplate(projectId: string, propertyId: string) {
  const { categories, items } = buildChecklist(projectId, propertyId, nowIso());
  await writeRows("checklist_categories", categories);
  await writeRows("checklist_items", items);
  return { categories: categories.length, items: items.length };
}

/** Copies another property's checklist structure (statuses reset). */
export async function copyChecklist(fromPropertyId: string, to: Pick<Property, "id" | "project_id">) {
  const db = getDB();
  const at = nowIso();
  const cats = (await db.checklist_categories.where("property_id").equals(fromPropertyId).filter(alive).toArray()).sort((a, b) => a.sort_order - b.sort_order);
  const items = await db.checklist_items.where("property_id").equals(fromPropertyId).filter(alive).toArray();
  const idMap = new Map<string, string>();
  const newCats: ChecklistCategory[] = cats.map((c) => {
    const id = uid();
    idMap.set(c.id, id);
    return { ...c, id, project_id: to.project_id, property_id: to.id, created_at: at, updated_at: at };
  });
  const newItems: ChecklistItem[] = items
    .filter((i) => idMap.has(i.category_id))
    .map((i) => ({ ...i, id: uid(), category_id: idMap.get(i.category_id)!, project_id: to.project_id, property_id: to.id, status: "NOT_CHECKED", note: null, checked_at: null, checked_by: null, created_at: at, updated_at: at }));
  await writeRows("checklist_categories", newCats);
  await writeRows("checklist_items", newItems);
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
  return insertRow("checklist_items", {
    ...values,
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
  // Moving category → append at the end of the new category.
  if (current.category_id !== values.category_id) {
    const siblings = await getDB().checklist_items.where("category_id").equals(values.category_id).filter(alive).toArray();
    const maxOrder = siblings.reduce((m, i) => Math.max(m, i.sort_order), 0);
    return patchRow("checklist_items", id, { ...values, code: values.code || current.code, sort_order: maxOrder + 10 });
  }
  return patchRow("checklist_items", id, { ...values, code: values.code || current.code });
}

export const deleteItem = (id: string) => softDelete("checklist_items", [id]);

export function setItemStatus(id: string, status: ItemStatus, userId: string | null) {
  const checked = status !== "NOT_CHECKED";
  return patchRow("checklist_items", id, { status, checked_at: checked ? nowIso() : null, checked_by: checked ? userId : null });
}

export const setItemNote = (id: string, note: string) => patchRow("checklist_items", id, { note: note.trim() || null });

/** Swap sort order with the neighbour in the given direction. Works for items and categories. */
export async function move(table: "checklist_items" | "checklist_categories", id: string, dir: -1 | 1) {
  const db = getDB();
  const row = await db.table(table).get(id) as ChecklistItem | ChecklistCategory | undefined;
  if (!row) return;
  const siblings = (table === "checklist_items"
    ? await db.checklist_items.where("category_id").equals((row as ChecklistItem).category_id).filter(alive).toArray()
    : await db.checklist_categories.where("property_id").equals(row.property_id).filter(alive).toArray()
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

/**
 * Seeds the default project/property once per owner. Seeding is skipped when the
 * owner already has any project (e.g. pulled from another device).
 */
export async function seedDefaultData(ownerId: string | null): Promise<boolean> {
  const db = getDB();
  const flag = `seeded:${ownerId ?? "local"}`;
  if (await getMeta<boolean>(flag)) return false;
  const hasProjects = (await db.projects.filter(alive).count()) > 0;
  if (!hasProjects) {
    const project = await createProject({ ...DEFAULT_PROJECT, inspection_date: null, reinspection_date: null }, ownerId);
    const property = await createProperty(project.id, { ...DEFAULT_PROPERTY }, { withTemplate: true });
    await setMeta("currentPropertyId", property.id);
  }
  await setMeta(flag, true);
  return !hasProjects;
}

export type { Project, Property };
