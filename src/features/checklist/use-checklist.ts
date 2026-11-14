"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import type { ChecklistCategory, ChecklistItem } from "@/lib/domain/types";

export interface ChecklistData {
  categories: ChecklistCategory[];
  items: ChecklistItem[];
  byCategory: Map<string, ChecklistItem[]>;
  locations: string[];
}

export function useChecklist(propertyId: string | undefined): ChecklistData | undefined {
  return useLiveQuery(async () => {
    if (!propertyId) return { categories: [], items: [], byCategory: new Map(), locations: [] };
    const db = getDB();
    const [categories, items] = await Promise.all([
      db.checklist_categories.where("property_id").equals(propertyId).filter(alive).toArray(),
      db.checklist_items.where("property_id").equals(propertyId).filter(alive).toArray(),
    ]);
    categories.sort((a, b) => a.sort_order - b.sort_order);
    const catIds = new Set(categories.map((c) => c.id));
    const visible = items.filter((i) => catIds.has(i.category_id));
    const byCategory = new Map<string, ChecklistItem[]>(categories.map((c) => [c.id, []]));
    for (const it of visible) byCategory.get(it.category_id)!.push(it);
    for (const list of byCategory.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    const locations = [...new Set(visible.map((i) => i.location).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b, "th"));
    return { categories, items: visible, byCategory, locations };
  }, [propertyId]);
}
