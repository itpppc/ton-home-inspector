import { describe, expect, it } from "vitest";
import { addDays, computeClaimDeadline, diffDays, todayInBangkok } from "@/lib/domain/deadline";

describe("claim deadline (15 days, transfer day excluded)", () => {
  it("never uses the planned date", () => {
    const r = computeClaimDeadline({ transferDateActual: null, transferDatePlanned: "2026-11-18", today: "2026-11-20" });
    expect(r.state).toBe("NO_ACTUAL_DATE");
    expect(r.deadline).toBeNull();
    expect(r.plannedDate).toBe("2026-11-18");
  });

  it("transfer 18 Nov → last day 3 Dec", () => {
    const r = computeClaimDeadline({ transferDateActual: "2026-11-18", today: "2026-11-18" });
    expect(r.deadline).toBe("2026-12-03");
    expect(r.daysRemaining).toBe(15);
    expect(r.state).toBe("OPEN");
  });

  it.each([
    ["2026-11-17", "NOT_STARTED"],
    ["2026-11-29", "OPEN"],
    ["2026-11-30", "URGENT"],
    ["2026-12-03", "LAST_DAY"],
    ["2026-12-04", "EXPIRED"],
  ])("today %s → %s", (today, state) => {
    expect(computeClaimDeadline({ transferDateActual: "2026-11-18", today }).state).toBe(state);
  });

  it("respects a custom window and rejects invalid dates", () => {
    expect(computeClaimDeadline({ transferDateActual: "2026-11-18", windowDays: 30, today: "2026-11-18" }).deadline).toBe("2026-12-18");
    expect(computeClaimDeadline({ transferDateActual: "2026-02-30", today: "2026-11-18" }).state).toBe("NO_ACTUAL_DATE");
    expect(() => addDays("2026-02-30", 1)).toThrow();
  });

  it("handles month/year/leap boundaries", () => {
    expect(addDays("2026-12-25", 15)).toBe("2027-01-09");
    expect(addDays("2028-02-20", 15)).toBe("2028-03-06");
    expect(diffDays("2026-11-18", "2026-12-03")).toBe(15);
  });

  it("uses the Bangkok calendar day", () => {
    expect(todayInBangkok(new Date("2026-11-17T17:30:00Z"))).toBe("2026-11-18"); // 00:30 ICT
    expect(todayInBangkok(new Date("2026-11-17T16:59:00Z"))).toBe("2026-11-17");
  });
});
