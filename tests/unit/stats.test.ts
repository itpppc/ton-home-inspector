import { describe, expect, it } from "vitest";
import { checklistStats, defectStats, nextDefectCode } from "@/lib/domain/stats";
import type { ItemStatus } from "@/lib/domain/types";

const items = (spec: Partial<Record<ItemStatus, number>>) =>
  Object.entries(spec).flatMap(([status, n]) => Array.from({ length: n ?? 0 }, () => ({ status: status as ItemStatus })));

describe("checklistStats", () => {
  it("matches the master-prompt example: 200 total, 120 pass, 20 fail, 60 pending → 70%", () => {
    const s = checklistStats(items({ PASS: 120, FAIL: 20, NOT_CHECKED: 60 }));
    expect(s.total).toBe(200);
    expect(s.pending).toBe(60);
    expect(s.progressPct).toBe(70);
  });

  it("never counts unchecked items as passed", () => {
    const s = checklistStats(items({ NOT_CHECKED: 10 }));
    expect(s.counts.PASS).toBe(0);
    expect(s.progressPct).toBe(0);
    expect(s.passRatePct).toBe(0);
  });

  it("excludes N/A from pass rate but counts it as checked", () => {
    const s = checklistStats(items({ PASS: 8, FAIL: 2, NOT_APPLICABLE: 10 }));
    expect(s.progressPct).toBe(100);
    expect(s.passRatePct).toBe(80);
  });

  it("handles an empty checklist", () => {
    expect(checklistStats([]).progressPct).toBe(0);
  });
});

describe("defectStats", () => {
  it("counts critical open, resolved and pending", () => {
    const s = defectStats([
      { status: "OPEN", severity: "CRITICAL" },
      { status: "VERIFIED", severity: "CRITICAL" },
      { status: "FIXED", severity: "LOW" },
    ]);
    expect(s).toMatchObject({ total: 3, resolved: 1, pending: 2, criticalOpen: 1 });
  });

  it("generates sequential defect codes", () => {
    expect(nextDefectCode([])).toBe("D-001");
    expect(nextDefectCode([{ code: "D-009" }, { code: "D-002" }, { code: "X" }])).toBe("D-010");
  });
});
