import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { bySeverityThenDate } from "@/lib/domain/stats";
import type { ChecklistCategory, ChecklistItem, Defect, DefectEvent, Photo, Project, Property, Room } from "@/lib/domain/types";

/** Everything a report/export needs for one property — a plain snapshot, safe to pass to pure builders. */
export interface ReportData {
  generatedAt: string;
  project: Project | null;
  property: Property;
  rooms: Room[];
  categories: ChecklistCategory[];
  /** Ordered by category order, then item order. */
  items: ChecklistItem[];
  /** Most severe / oldest first. */
  defects: Defect[];
  /** Oldest first. */
  events: DefectEvent[];
  /** Oldest first. */
  photos: Photo[];
}

export async function loadReportData(propertyId: string): Promise<ReportData | null> {
  const db = getDB();
  const property = await db.properties.get(propertyId);
  if (!property || !alive(property)) return null;
  const [project, rooms, categories, items, defects, photos] = await Promise.all([
    db.projects.get(property.project_id),
    db.rooms.where("property_id").equals(propertyId).filter(alive).toArray(),
    db.checklist_categories.where("property_id").equals(propertyId).filter(alive).toArray(),
    db.checklist_items.where("property_id").equals(propertyId).filter(alive).toArray(),
    db.defects.where("property_id").equals(propertyId).filter(alive).toArray(),
    db.photos.where("property_id").equals(propertyId).filter(alive).toArray(),
  ]);
  categories.sort((a, b) => a.sort_order - b.sort_order);
  rooms.sort((a, b) => a.sort_order - b.sort_order);
  const catOrder = new Map(categories.map((c, i) => [c.id, i]));
  const visibleItems = items.filter((i) => catOrder.has(i.category_id));
  visibleItems.sort((a, b) => catOrder.get(a.category_id)! - catOrder.get(b.category_id)! || a.sort_order - b.sort_order);
  defects.sort(bySeverityThenDate);
  const defectIds = defects.map((d) => d.id);
  const events = defectIds.length ? (await db.defect_events.where("defect_id").anyOf(defectIds).filter(alive).toArray()) : [];
  events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  photos.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  return { generatedAt: new Date().toISOString(), project: project && alive(project) ? project : null, property, rooms, categories, items: visibleItems, defects, events, photos };
}
