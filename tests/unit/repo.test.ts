import { beforeEach, describe, expect, it } from "vitest";
import { InspectorDB, setDB, getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import * as repo from "@/lib/db/repo";
import { shouldApplyRemote } from "@/lib/sync/engine";
import { CHECKLIST_TEMPLATE } from "@/lib/seed/checklist-template";

let n = 0;
beforeEach(() => {
  setDB(new InspectorDB(`test-${++n}`));
});

const expectedItems = CHECKLIST_TEMPLATE.reduce((s, c) => s + c.items.reduce((a, i) => a + (i.locations?.length || 1), 0), 0);

describe("seed", () => {
  it("creates the default project/property with the full checklist exactly once", async () => {
    expect(await repo.seedDefaultData(null)).toBe(true);
    expect(await repo.seedDefaultData(null)).toBe(false);
    const db = getDB();
    const [project] = await db.projects.toArray();
    const [property] = await db.properties.toArray();
    expect(project.name).toBe("Siri Place Rama 2");
    expect(property).toMatchObject({ plot_number: "1240-032002", house_model: "TH99B", land_area_sqw: 16.2, transfer_date_planned: "2026-11-18", transfer_date_actual: null, claim_window_days: 15 });
    expect(await db.checklist_items.count()).toBe(expectedItems);
    expect(expectedItems).toBeGreaterThan(150);
    // every write is queued for sync
    expect(await db.outbox.count()).toBe(2 + CHECKLIST_TEMPLATE.length + expectedItems);
    const codes = (await db.checklist_items.toArray()).map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("checklist management", () => {
  it("creates, edits, reorders, sets status and soft-deletes", async () => {
    await repo.seedDefaultData(null);
    const db = getDB();
    const property = (await db.properties.toArray())[0];
    const cat = await repo.createCategory(property, "  งานพิเศษ ");
    expect(cat.name).toBe("งานพิเศษ");
    const a = await repo.createItem(property, { category_id: cat.id, code: "", location: null, title: "A", description: null, method: null, acceptance_criteria: null, priority: "HIGH" });
    const b = await repo.createItem(property, { category_id: cat.id, code: "", location: null, title: "B", description: null, method: null, acceptance_criteria: null, priority: "LOW" });
    expect(a.code).not.toBe(b.code);

    await repo.move("checklist_items", b.id, -1);
    const ordered = (await db.checklist_items.where("category_id").equals(cat.id).toArray()).sort((x, y) => x.sort_order - y.sort_order);
    expect(ordered.map((i) => i.title)).toEqual(["B", "A"]);

    await repo.setItemStatus(a.id, "FAIL", "u1");
    expect(await db.checklist_items.get(a.id)).toMatchObject({ status: "FAIL", checked_by: "u1" });
    await repo.setItemStatus(a.id, "NOT_CHECKED", "u1");
    expect(await db.checklist_items.get(a.id)).toMatchObject({ status: "NOT_CHECKED", checked_at: null, checked_by: null });

    await repo.deleteCategory(cat.id);
    expect((await db.checklist_items.where("category_id").equals(cat.id).filter(alive).count())).toBe(0);
    expect((await db.checklist_items.get(a.id))?.deleted_at).not.toBeNull();
  });

  it("rejects an item for a category of another property", async () => {
    await repo.seedDefaultData(null);
    const db = getDB();
    const project = (await db.projects.toArray())[0];
    const other = await repo.createProperty(project.id, { name: "อีกหลัง", plot_number: null, house_model: null, property_type: null, land_area_sqw: null, usable_area_sqm: null, floors: null, construction_status: "READY_FOR_INSPECTION", inspection_type: null, inspection_owner: null, transfer_date_planned: null, transfer_date_actual: null, claim_window_days: 15, warranty_info: null, price: null, booking_fee: null, cashback: null, notes: null }, { withTemplate: false });
    const foreignCat = (await db.checklist_categories.toArray())[0];
    await expect(repo.createItem(other, { category_id: foreignCat.id, code: "", location: null, title: "x", description: null, method: null, acceptance_criteria: null, priority: "LOW" })).rejects.toThrow();
  });

  it("copies a checklist with fresh ids and reset statuses", async () => {
    await repo.seedDefaultData(null);
    const db = getDB();
    const src = (await db.properties.toArray())[0];
    const item = (await db.checklist_items.toArray())[0];
    await repo.setItemStatus(item.id, "PASS", null);
    const dest = await repo.createProperty(src.project_id, { ...src, name: "หลังที่ 2" }, { withTemplate: false });
    await repo.copyChecklist(src.id, dest);
    const copied = await db.checklist_items.where("property_id").equals(dest.id).toArray();
    expect(copied.length).toBe(expectedItems);
    expect(copied.every((i) => i.status === "NOT_CHECKED")).toBe(true);
    expect(copied.some((i) => i.id === item.id)).toBe(false);
  });

  it("cascades soft delete from project", async () => {
    await repo.seedDefaultData(null);
    const db = getDB();
    const project = (await db.projects.toArray())[0];
    await repo.deleteProject(project.id);
    expect(await db.properties.filter(alive).count()).toBe(0);
    expect(await db.checklist_items.filter(alive).count()).toBe(0);
  });
});

describe("sync merge rule (LWW)", () => {
  it("applies remote when no pending local change", () => {
    expect(shouldApplyRemote({ updated_at: "2026-11-15T00:00:00Z" }, { updated_at: "2026-11-14T00:00:00Z" }, false)).toBe(true);
  });
  it("keeps a newer pending local edit", () => {
    expect(shouldApplyRemote({ updated_at: "2026-11-15T00:00:00Z" }, { updated_at: "2026-11-14T00:00:00Z" }, true)).toBe(false);
  });
  it("takes a newer remote even with pending local", () => {
    expect(shouldApplyRemote({ updated_at: "2026-11-14T00:00:00Z" }, { updated_at: "2026-11-15T00:00:00Z" }, true)).toBe(true);
  });
  it("inserts unknown rows", () => {
    expect(shouldApplyRemote(undefined, { updated_at: "x" }, false)).toBe(true);
  });
});
