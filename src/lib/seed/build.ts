import { uid } from "@/lib/utils";
import type { ChecklistCategory, ChecklistItem } from "@/lib/domain/types";
import { CHECKLIST_TEMPLATE, type TemplateCategory } from "./checklist-template";

/** Expands the template into concrete category + item rows for one property. */
export function buildChecklist(
  projectId: string,
  propertyId: string,
  at: string,
  template: TemplateCategory[] = CHECKLIST_TEMPLATE,
): { categories: ChecklistCategory[]; items: ChecklistItem[] } {
  const categories: ChecklistCategory[] = [];
  const items: ChecklistItem[] = [];
  const base = { project_id: projectId, property_id: propertyId, created_at: at, updated_at: at, deleted_at: null };

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
          code: `${cat.code}-${String(n).padStart(3, "0")}`,
          location,
          title: t.title,
          description: t.description ?? null,
          method: t.method,
          acceptance_criteria: t.criteria,
          priority: t.priority,
          sort_order: n * 10,
          status: "NOT_CHECKED",
          note: null,
          checked_at: null,
          checked_by: null,
        });
      }
    }
  });
  return { categories, items };
}
