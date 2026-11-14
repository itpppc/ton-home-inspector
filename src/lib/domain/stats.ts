import type { ChecklistCategory, ChecklistItem, Defect, ItemStatus, Severity, DefectStatus } from "./types";
import { DEFECT_STATUSES, ITEM_STATUSES, SEVERITIES } from "./types";

export interface ChecklistStats {
  total: number;
  counts: Record<ItemStatus, number>;
  /** Items that received a decision (anything but NOT_CHECKED). */
  checked: number;
  pending: number;
  /** checked / total — skipped or unchecked items never count as passed. */
  progressPct: number;
  /** PASS / (total − N/A). */
  passRatePct: number;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

export function checklistStats(items: Pick<ChecklistItem, "status">[]): ChecklistStats {
  const counts = Object.fromEntries(ITEM_STATUSES.map((s) => [s, 0])) as Record<ItemStatus, number>;
  for (const it of items) counts[it.status] = (counts[it.status] ?? 0) + 1;
  const total = items.length;
  const pending = counts.NOT_CHECKED;
  const checked = total - pending;
  return {
    total,
    counts,
    checked,
    pending,
    progressPct: pct(checked, total),
    passRatePct: pct(counts.PASS, total - counts.NOT_APPLICABLE),
  };
}

export const isDefectResolved = (d: Pick<Defect, "status">) => d.status === "VERIFIED";

export interface DefectStats {
  total: number;
  resolved: number;
  pending: number;
  criticalOpen: number;
  bySeverity: Record<Severity, number>;
  byStatus: Record<DefectStatus, number>;
}

export function defectStats(defects: Pick<Defect, "status" | "severity">[]): DefectStats {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  const byStatus = Object.fromEntries(DEFECT_STATUSES.map((s) => [s, 0])) as Record<DefectStatus, number>;
  let resolved = 0;
  let criticalOpen = 0;
  for (const d of defects) {
    bySeverity[d.severity]++;
    byStatus[d.status]++;
    if (isDefectResolved(d)) resolved++;
    else if (d.severity === "CRITICAL") criticalOpen++;
  }
  return { total: defects.length, resolved, pending: defects.length - resolved, criticalOpen, bySeverity, byStatus };
}

export function defectsByCategory(defects: Pick<Defect, "category">[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of defects) {
    const k = d.category?.trim() || "ไม่ระบุหมวด";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function categoryProgress(categories: ChecklistCategory[], items: ChecklistItem[]) {
  return [...categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => {
      const s = checklistStats(items.filter((i) => i.category_id === c.id));
      return { id: c.id, name: c.name, ...s };
    });
}

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const bySeverityThenDate = (a: Defect, b: Defect) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.found_at.localeCompare(b.found_at);

/** Next sequential defect code for a property, e.g. D-007. */
export function nextDefectCode(existing: Pick<Defect, "code">[]): string {
  const max = existing.reduce((m, d) => {
    const n = Number(/^D-(\d+)$/.exec(d.code)?.[1] ?? 0);
    return n > m ? n : m;
  }, 0);
  return `D-${String(max + 1).padStart(3, "0")}`;
}
