"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import type { ChecklistCategory, ChecklistItem, Defect, Room } from "@/lib/domain/types";

export interface ChecklistData {
  categories: ChecklistCategory[];
  items: ChecklistItem[];
  byCategory: Map<string, ChecklistItem[]>;
  rooms: Room[];
  /** Alive defects grouped by linked checklist item. */
  defectsByItem: Map<string, Defect[]>;
  /** Alive photo count per checklist item (item photos + photos of its defects are separate). */
  photoCountByItem: Map<string, number>;
}

const EMPTY: ChecklistData = { categories: [], items: [], byCategory: new Map(), rooms: [], defectsByItem: new Map(), photoCountByItem: new Map() };

export function useChecklist(propertyId: string | undefined): ChecklistData | undefined {
  return useLiveQuery(async () => {
    if (!propertyId) return EMPTY;
    const db = getDB();
    const [categories, items, rooms, defects, photos] = await Promise.all([
      db.checklist_categories.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.checklist_items.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.rooms.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.defects.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.photos.where("property_id").equals(propertyId).filter((p) => alive(p) && !!p.item_id && !p.defect_id).toArray(),
    ]);
    categories.sort((a, b) => a.sort_order - b.sort_order);
    rooms.sort((a, b) => a.sort_order - b.sort_order);
    const catIds = new Set(categories.map((c) => c.id));
    const visible = items.filter((i) => catIds.has(i.category_id));
    const byCategory = new Map<string, ChecklistItem[]>(categories.map((c) => [c.id, []]));
    for (const it of visible) byCategory.get(it.category_id)!.push(it);
    for (const list of byCategory.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    const defectsByItem = new Map<string, Defect[]>();
    for (const d of defects) if (d.item_id) defectsByItem.set(d.item_id, [...(defectsByItem.get(d.item_id) ?? []), d]);
    const photoCountByItem = new Map<string, number>();
    for (const p of photos) photoCountByItem.set(p.item_id!, (photoCountByItem.get(p.item_id!) ?? 0) + 1);
    return { categories, items: visible, byCategory, rooms, defectsByItem, photoCountByItem };
  }, [propertyId]);
}
