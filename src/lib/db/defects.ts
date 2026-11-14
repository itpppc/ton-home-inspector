import type {
  ChecklistItem,
  Defect,
  DefectStatus,
  Property,
} from "@/lib/domain/types";
import type { DefectValues } from "@/lib/domain/schemas";
import { DEFECT_TRANSITIONS } from "@/lib/domain/labels";
import { nextDefectCode } from "@/lib/domain/stats";
import { roomLabel } from "@/lib/seed/checklist-template";
import { nowIso, uid } from "@/lib/utils";
import { getDB } from "./local";
import { alive, writeRows } from "./mutations";

/**
 * Defect workflow engine. Every status change writes a defect_event (audit trail) and
 * keeps the linked checklist item in step:
 *   defect open/reopened → item FAIL · FIXED → item NEEDS_REINSPECTION · all VERIFIED → item PASS
 */

/** Runs a multi-table defect change as ONE IndexedDB transaction (nested writeRows join it). */
function atomic<T>(fn: () => Promise<T>): Promise<T> {
  const db = getDB();
  return db.transaction(
    "rw",
    [
      db.defects,
      db.defect_events,
      db.checklist_items,
      db.rooms,
      db.photos,
      db.outbox,
    ],
    fn,
  );
}

async function roomInfo(roomId: string | null, propertyId: string) {
  if (!roomId) return null;
  const room = await getDB().rooms.get(roomId);
  if (!room || !alive(room) || room.property_id !== propertyId)
    throw new Error("ห้องไม่ถูกต้อง");
  return roomLabel(room);
}

function event(
  defect: Defect,
  from: DefectStatus | null,
  to: DefectStatus,
  note: string | null,
  actor: string | null,
  at: string,
) {
  return {
    id: uid(),
    project_id: defect.project_id,
    defect_id: defect.id,
    from_status: from,
    to_status: to,
    note,
    actor,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
}

/** Item status implied by the open defects linked to it (null = leave as is). */
export function itemStatusFor(
  defects: Pick<Defect, "status">[],
): ChecklistItem["status"] | null {
  if (defects.length === 0) return null;
  if (
    defects.some(
      (d) =>
        d.status === "OPEN" ||
        d.status === "REOPENED" ||
        d.status === "SUBMITTED" ||
        d.status === "IN_PROGRESS",
    )
  )
    return "FAIL";
  if (defects.some((d) => d.status === "FIXED")) return "NEEDS_REINSPECTION";
  return "PASS"; // all verified
}

async function syncItem(
  itemId: string | null,
  actor: string | null,
  at: string,
) {
  if (!itemId) return;
  const db = getDB();
  const item = await db.checklist_items.get(itemId);
  if (!item || !alive(item)) return;
  const linked = await db.defects
    .where("item_id")
    .equals(itemId)
    .filter(alive)
    .toArray();
  const status = itemStatusFor(linked);
  if (!status || status === item.status) return;
  await writeRows("checklist_items", [
    { ...item, status, checked_at: at, checked_by: actor, updated_at: at },
  ]);
}

export function createDefect(args: {
  property: Pick<Property, "id" | "project_id">;
  values: DefectValues;
  itemId?: string | null;
  actor: string | null;
}): Promise<Defect> {
  return atomic(async () => {
    const db = getDB();
    const at = nowIso();
    const { property, values, actor } = args;
    const itemId = args.itemId ?? null;
    if (itemId) {
      const item = await db.checklist_items.get(itemId);
      if (!item || item.property_id !== property.id)
        throw new Error("รายการตรวจไม่ถูกต้อง");
    }
    const existing = await db.defects
      .where("property_id")
      .equals(property.id)
      .toArray(); // include deleted: codes never reused
    const defect: Defect = {
      id: uid(),
      project_id: property.project_id,
      property_id: property.id,
      item_id: itemId,
      room_id: values.room_id,
      code: nextDefectCode(existing),
      title: values.title,
      description: values.description,
      category: values.category,
      location: await roomInfo(values.room_id, property.id),
      severity: values.severity,
      status: "OPEN",
      requires_engineer: values.requires_engineer,
      recommendation: values.recommendation,
      found_at: at,
      due_date: values.due_date,
      fixed_at: null,
      verified_at: null,
      created_by: actor,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    };
    await writeRows("defects", [defect]);
    await writeRows("defect_events", [
      event(defect, null, "OPEN", null, actor, at),
    ]);
    await syncItem(itemId, actor, at);
    return defect;
  });
}

export async function updateDefect(id: string, values: DefectValues) {
  const db = getDB();
  const current = await db.defects.get(id);
  if (!current || !alive(current)) throw new Error("ไม่พบ Defect");
  const at = nowIso();
  const next: Defect = {
    ...current,
    ...values,
    location: await roomInfo(values.room_id, current.property_id),
    updated_at: at,
  };
  await writeRows("defects", [next]);
  return next;
}

export function canTransition(from: DefectStatus, to: DefectStatus) {
  return DEFECT_TRANSITIONS[from].includes(to);
}

export function transitionDefect(
  id: string,
  to: DefectStatus,
  note: string | null,
  actor: string | null,
): Promise<Defect> {
  return atomic(async () => {
    const db = getDB();
    const current = await db.defects.get(id);
    if (!current || !alive(current)) throw new Error("ไม่พบ Defect");
    if (!canTransition(current.status, to))
      throw new Error(`เปลี่ยนสถานะจาก ${current.status} เป็น ${to} ไม่ได้`);
    const cleanNote = note?.trim() || null;
    if (to === "REOPENED" && !cleanNote)
      throw new Error("กรุณาระบุเหตุผลที่ตรวจซ้ำไม่ผ่าน");
    const at = nowIso();
    const next: Defect = {
      ...current,
      status: to,
      fixed_at:
        to === "FIXED" ? at : to === "REOPENED" ? null : current.fixed_at,
      verified_at: to === "VERIFIED" ? at : null,
      updated_at: at,
    };
    await writeRows("defects", [next]);
    await writeRows("defect_events", [
      event(current, current.status, to, cleanNote, actor, at),
    ]);
    await syncItem(current.item_id, actor, at);
    return next;
  });
}

export function deleteDefect(id: string, actor: string | null) {
  return atomic(async () => {
    const db = getDB();
    const current = await db.defects.get(id);
    if (!current) return;
    const at = nowIso();
    const photos = await db.photos
      .where("defect_id")
      .equals(id)
      .filter(alive)
      .toArray();
    await writeRows(
      "photos",
      photos.map((p) => ({ ...p, deleted_at: at, updated_at: at })),
    );
    await writeRows("defects", [
      { ...current, deleted_at: at, updated_at: at },
    ]);
    await syncItem(current.item_id, actor, at);
  });
}
