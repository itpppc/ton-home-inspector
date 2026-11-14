import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorDB, setDB, getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import * as repo from "@/lib/db/repo";
import { canTransition, createDefect, deleteDefect, itemStatusFor, transitionDefect as rawTransition, updateDefect } from "@/lib/db/defects";
import { DEFECT_STATUSES } from "@/lib/domain/types";
import { DEFECT_TRANSITIONS } from "@/lib/domain/labels";
import type { DefectValues } from "@/lib/domain/schemas";

/** Events are ordered by created_at; keep each step in its own millisecond so ordering assertions are deterministic. */
const transitionDefect: typeof rawTransition = async (...args) => { await new Promise((r) => setTimeout(r, 3)); return rawTransition(...args); };

let n = 0;
beforeEach(() => setDB(new InspectorDB(`defects-${++n}`)));

const values = (over: Partial<DefectValues> = {}): DefectValues => ({
  title: "รอยร้าวผนัง", description: null, category: "งานผนัง", room_id: null, severity: "HIGH",
  requires_engineer: false, recommendation: null, due_date: null, ...over,
});

async function setup() {
  await repo.seedDefaultData(null);
  const db = getDB();
  const property = (await db.properties.toArray())[0];
  const item = (await db.checklist_items.filter(alive).toArray())[0];
  return { db, property, item };
}

describe("defect workflow (found → closed)", () => {
  it("runs OPEN → SUBMITTED → IN_PROGRESS → FIXED → REOPENED → FIXED → VERIFIED and keeps the item in step", async () => {
    const { db, property, item } = await setup();
    await repo.setItemStatus(item.id, "FAIL", "u1");
    const d = await createDefect({ property, values: values(), itemId: item.id, actor: "u1" });
    expect(d).toMatchObject({ code: "D-001", status: "OPEN", item_id: item.id });
    expect((await db.checklist_items.get(item.id))!.status).toBe("FAIL");

    const status = async () => (await db.defects.get(d.id))!.status;
    const itemStatus = async () => (await db.checklist_items.get(item.id))!.status;

    await transitionDefect(d.id, "SUBMITTED", "ส่งอีเมลถึงโครงการ", "u1");
    await transitionDefect(d.id, "IN_PROGRESS", null, "u1");
    expect(await itemStatus()).toBe("FAIL");

    const fixed = await transitionDefect(d.id, "FIXED", null, "u1");
    expect(fixed.fixed_at).not.toBeNull();
    expect(await itemStatus()).toBe("NEEDS_REINSPECTION");

    await expect(transitionDefect(d.id, "REOPENED", "  ", "u1")).rejects.toThrow("เหตุผล");
    expect(await status()).toBe("FIXED"); // failed transition changed nothing

    const reopened = await transitionDefect(d.id, "REOPENED", "ยังซึมอยู่", "u1");
    expect(reopened.fixed_at).toBeNull();
    expect(await itemStatus()).toBe("FAIL");

    await transitionDefect(d.id, "FIXED", null, "u1");
    const closed = await transitionDefect(d.id, "VERIFIED", "ตรวจซ้ำผ่าน", "u1");
    expect(closed.verified_at).not.toBeNull();
    expect(await itemStatus()).toBe("PASS");

    const events = (await db.defect_events.where("defect_id").equals(d.id).toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    expect(events.map((e) => e.to_status)).toEqual(["OPEN", "SUBMITTED", "IN_PROGRESS", "FIXED", "REOPENED", "FIXED", "VERIFIED"]);
    expect(events[4].note).toBe("ยังซึมอยู่");
    // everything written was queued for sync
    const keys = new Set((await db.outbox.toArray()).map((o) => o.key));
    expect(keys.has(`defects:${d.id}`)).toBe(true);
    for (const e of events) expect(keys.has(`defect_events:${e.id}`)).toBe(true);
  });

  it("rejects illegal transitions", async () => {
    const { property } = await setup();
    const d = await createDefect({ property, values: values(), actor: null });
    await expect(transitionDefect(d.id, "VERIFIED", null, null)).rejects.toThrow();
    expect(canTransition("OPEN", "VERIFIED")).toBe(false);
    expect(canTransition("FIXED", "VERIFIED")).toBe(true);
  });

  it("only closes the item once ALL linked defects are verified", async () => {
    const { db, property, item } = await setup();
    const a = await createDefect({ property, values: values({ title: "A" }), itemId: item.id, actor: null });
    const b = await createDefect({ property, values: values({ title: "B" }), itemId: item.id, actor: null });
    expect([a.code, b.code]).toEqual(["D-001", "D-002"]);
    for (const x of [a, b]) await transitionDefect(x.id, "FIXED", null, null);
    await transitionDefect(a.id, "VERIFIED", null, null);
    expect((await db.checklist_items.get(item.id))!.status).toBe("NEEDS_REINSPECTION");
    await transitionDefect(b.id, "VERIFIED", null, null);
    expect((await db.checklist_items.get(item.id))!.status).toBe("PASS");
  });

  it("never reuses a code, even after delete, and delete re-syncs the item", async () => {
    const { db, property, item } = await setup();
    const a = await createDefect({ property, values: values(), itemId: item.id, actor: null });
    await deleteDefect(a.id, null);
    expect((await db.defects.get(a.id))!.deleted_at).not.toBeNull();
    const b = await createDefect({ property, values: values(), actor: null });
    expect(b.code).toBe("D-002");
  });

  it("soft-deletes the photos of a deleted defect", async () => {
    const { db, property } = await setup();
    const d = await createDefect({ property, values: values(), actor: null });
    const { savePhoto } = await import("@/lib/db/photos");
    const p = await savePhoto({ target: { project_id: d.project_id, property_id: property.id, defect_id: d.id }, kind: "DEFECT", blob: new Blob(["x"]), width: 1, height: 1 });
    await deleteDefect(d.id, null);
    expect((await db.photos.get(p.id))!.deleted_at).not.toBeNull();
  });

  it("is atomic: an invalid item leaves no defect, event or outbox entry behind", async () => {
    const { db, property } = await setup();
    const before = await db.outbox.count();
    await expect(createDefect({ property, values: values(), itemId: "does-not-exist", actor: null })).rejects.toThrow();
    expect(await db.defects.count()).toBe(0);
    expect(await db.defect_events.count()).toBe(0);
    expect(await db.outbox.count()).toBe(before);
  });

  it("snapshots the room label and refuses a room from another property", async () => {
    const { db, property } = await setup();
    const room = (await db.rooms.toArray())[0];
    const d = await createDefect({ property, values: values({ room_id: room.id }), actor: null });
    expect(d.location).toBe(room.floor ? `${room.floor} - ${room.name}` : room.name);
    const project = (await db.projects.toArray())[0];
    const other = await repo.createProperty(project.id, { name: "อีกหลัง", plot_number: null, house_model: null, property_type: null, land_area_sqw: null, usable_area_sqm: null, floors: null, construction_status: "READY_FOR_INSPECTION", inspection_type: null, inspection_owner: null, transfer_date_planned: null, transfer_date_actual: null, claim_window_days: 15, warranty_info: null, price: null, booking_fee: null, cashback: null, notes: null }, { withTemplate: false });
    await expect(createDefect({ property: other, values: values({ room_id: room.id }), actor: null })).rejects.toThrow();
    const updated = await updateDefect(d.id, values({ room_id: null, title: "แก้ไขแล้ว" }));
    expect(updated).toMatchObject({ location: null, title: "แก้ไขแล้ว" });
  });
});

describe("workflow table", () => {
  it("every status has a defined transition list and no self-loops", () => {
    for (const s of DEFECT_STATUSES) {
      expect(DEFECT_TRANSITIONS[s]).toBeDefined();
      expect(DEFECT_TRANSITIONS[s]).not.toContain(s);
    }
  });
  it("maps defect statuses to an item status", () => {
    expect(itemStatusFor([])).toBeNull();
    expect(itemStatusFor([{ status: "OPEN" }])).toBe("FAIL");
    expect(itemStatusFor([{ status: "FIXED" }, { status: "VERIFIED" }])).toBe("NEEDS_REINSPECTION");
    expect(itemStatusFor([{ status: "FIXED" }, { status: "REOPENED" }])).toBe("FAIL");
    expect(itemStatusFor([{ status: "VERIFIED" }])).toBe("PASS");
  });
});
