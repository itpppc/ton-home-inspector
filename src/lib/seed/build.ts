import { uid } from "@/lib/utils";
import type { ChecklistCategory, ChecklistItem, Room } from "@/lib/domain/types";
import { CHECKLIST_TEMPLATE, DEFAULT_ROOMS, roomLabel, type TemplateCategory } from "./checklist-template";

/** Expands the template into concrete room, category and item rows for one property. */
export function buildChecklist(
  projectId: string,
  propertyId: string,
  at: string,
  template: TemplateCategory[] = CHECKLIST_TEMPLATE,
  existingRooms: Room[] = [],
): { rooms: Room[]; categories: ChecklistCategory[]; items: ChecklistItem[] } {
  const base = { project_id: projectId, property_id: propertyId, created_at: at, updated_at: at, deleted_at: null };
  // Reuse rooms that already exist (matched by label) so re-applying never duplicates rooms.
  const byLabel = new Map(existingRooms.map((r) => [roomLabel(r), r.id]));
  const maxOrder = existingRooms.reduce((m, r) => Math.max(m, r.sort_order), 0);
  const rooms: Room[] = [];
  Object.values(DEFAULT_ROOMS).forEach((r, i) => {
    const label = roomLabel(r);
    if (byLabel.has(label)) return;
    const room: Room = { ...base, id: uid(), name: r.name, floor: r.floor, sort_order: maxOrder + (i + 1) * 10 };
    rooms.push(room);
    byLabel.set(label, room.id);
  });

  const categories: ChecklistCategory[] = [];
  const items: ChecklistItem[] = [];
  template.forEach((cat, ci) => {
    const category: ChecklistCategory = { ...base, id: uid(), name: cat.name, sort_order: (ci + 1) * 10 };
    categories.push(category);
    let n = 0;
    for (const t of cat.items) {
      const locations = t.locations && t.locations.length > 0 ? t.locations : [null];
      for (const location of locations) {
        n++;
        items.push({
          ...base,
          id: uid(),
          category_id: category.id,
          room_id: location ? byLabel.get(location) ?? null : null,
          code: `${cat.code}-${String(n).padStart(3, "0")}`,
          location,
          title: t.title,
          description: t.description ?? null,
          method: t.method,
          acceptance_criteria: t.criteria,
          priority: t.priority,
          scope: t.scope ?? cat.scope,
          sort_order: n * 10,
          status: "NOT_CHECKED",
          note: null,
          checked_at: null,
          checked_by: null,
        });
      }
    }
  });
  return { rooms, categories, items };
}
