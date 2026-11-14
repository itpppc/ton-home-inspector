"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { bySeverityThenDate } from "@/lib/domain/stats";
import type { ChecklistItem, Defect, DefectEvent, Room } from "@/lib/domain/types";

export interface DefectsData {
  defects: Defect[];
  rooms: Room[];
  categories: string[];
  photoCount: Map<string, number>;
}

export function useDefects(propertyId: string | undefined): DefectsData | undefined {
  return useLiveQuery(async () => {
    if (!propertyId) return { defects: [], rooms: [], categories: [], photoCount: new Map() };
    const db = getDB();
    const [defects, rooms, photos] = await Promise.all([
      db.defects.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.rooms.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.photos.where("property_id").equals(propertyId).filter((p) => alive(p) && !!p.defect_id).toArray(),
    ]);
    defects.sort(bySeverityThenDate);
    rooms.sort((a, b) => a.sort_order - b.sort_order);
    const photoCount = new Map<string, number>();
    for (const p of photos) photoCount.set(p.defect_id!, (photoCount.get(p.defect_id!) ?? 0) + 1);
    const categories = [...new Set(defects.map((d) => d.category).filter((c): c is string => !!c))];
    return { defects, rooms, categories, photoCount };
  }, [propertyId]);
}

export interface DefectDetail {
  defect: Defect;
  events: DefectEvent[];
  item: ChecklistItem | null;
  rooms: Room[];
  categories: string[];
}

/** null = not found / deleted, undefined = still loading. */
export function useDefect(id: string | null): DefectDetail | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const db = getDB();
    const defect = await db.defects.get(id);
    if (!defect || !alive(defect)) return null;
    const [events, item, rooms, siblings] = await Promise.all([
      db.defect_events.where("defect_id").equals(id).filter(alive).toArray(),
      defect.item_id ? db.checklist_items.get(defect.item_id) : Promise.resolve(undefined),
      db.rooms.where("property_id").equals(defect.property_id).filter(alive).toArray(),
      db.defects.where("property_id").equals(defect.property_id).filter(alive).toArray(),
    ]);
    events.sort((a, b) => a.created_at.localeCompare(b.created_at));
    rooms.sort((a, b) => a.sort_order - b.sort_order);
    const categories = [...new Set(siblings.map((d) => d.category).filter((c): c is string => !!c))];
    return { defect, events, item: item && alive(item) ? item : null, rooms, categories };
  }, [id], undefined);
}
