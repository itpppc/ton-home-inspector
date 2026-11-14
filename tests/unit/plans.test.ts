import { describe, expect, it } from "vitest";
import { addMonthsISODate, checkQuota, daysLeft, DEFAULT_PLANS, endOfLocalDayISO, friendlyServerError, isExpired, isPlanLimitError, renewFrom, type MyPlan } from "@/features/plans/plans";
import { adminStats } from "@/features/admin/admin-users";
import type { AdminUserRow } from "@/lib/domain/types";
import { readFileSync } from "node:fs";

const free: MyPlan = { plan: "FREE", plan_expires_at: null, effective: "FREE", unlimited: false, max_projects: 1, max_properties: 1, max_members: 2, projects: 0, properties: 0 };

describe("plans", () => {
  it("checks quotas; null limit and admins are unlimited", () => {
    expect(checkQuota(free, "properties", 0)).toEqual({ allowed: true, used: 0, limit: 1 });
    expect(checkQuota(free, "properties", 1).allowed).toBe(false);
    expect(checkQuota({ ...free, max_properties: null }, "properties", 999).allowed).toBe(true);
    expect(checkQuota({ ...free, unlimited: true }, "projects", 50)).toMatchObject({ allowed: true, limit: null });
    expect(checkQuota(null, "projects", 3).allowed).toBe(true);
  });

  it("maps server PLAN_LIMIT errors to Thai and passes others through", () => {
    expect(friendlyServerError('PLAN_LIMIT:properties:1')).toMatch(/บ้านสูงสุด 1 หลัง/);
    expect(friendlyServerError("ERROR: PLAN_LIMIT:members:5 (P0001)")).toMatch(/สมาชิกต่อโครงการสูงสุด 5 คน/);
    expect(friendlyServerError("permission denied")).toBe("permission denied");
    expect(isPlanLimitError("PLAN_LIMIT:projects:1")).toBe(true);
    expect(isPlanLimitError(null)).toBe(false);
  });

  it("detects a lapsed paid plan and days left", () => {
    expect(isExpired({ ...free, plan: "PRO", effective: "FREE" })).toBe(true);
    expect(isExpired({ ...free, plan: "PRO", effective: "PRO" })).toBe(false);
    expect(isExpired(free)).toBe(false);
    const now = Date.parse("2026-11-15T00:00:00Z");
    expect(daysLeft("2026-11-25T00:00:00Z", now)).toBe(10);
    expect(daysLeft("2026-11-14T00:00:00Z", now)).toBe(-1);
    expect(daysLeft(null, now)).toBeNull();
  });

  it("adds months with end-of-month clamping and renews from a future expiry", () => {
    expect(addMonthsISODate(new Date(2026, 0, 31), 1)).toBe("2026-02-28");
    expect(addMonthsISODate(new Date(2028, 0, 31), 1)).toBe("2028-02-29");
    expect(addMonthsISODate(new Date(2026, 10, 15), 12)).toBe("2027-11-15");
    const now = new Date(2026, 10, 15);
    expect(renewFrom(new Date(2026, 11, 1).toISOString(), now).getMonth()).toBe(11);
    expect(renewFrom(new Date(2026, 0, 1).toISOString(), now)).toBe(now);
    expect(renewFrom(null, now)).toBe(now);
    expect(new Date(endOfLocalDayISO("2026-12-31")).getHours()).toBe(23);
  });

  it("client fallback plans match the SQL seed", () => {
    const sql = readFileSync("supabase/migrations/20261115000007_plans.sql", "utf8");
    for (const p of DEFAULT_PLANS) {
      const lim = (v: number | null) => (v === null ? "null" : String(v));
      expect(sql).toContain(`('${p.tier}', '${p.name}', '${p.description}', ${p.price_thb}, '${p.billing_period}', ${lim(p.max_projects)}, ${lim(p.max_properties)}, ${lim(p.max_members)},`);
      for (const f of p.features) expect(sql).toContain(`'${f}'`);
    }
  });

  it("admin stats count active paid users only", () => {
    const base = { email: "a", full_name: null, role: "INSPECTOR", created_at: "2026-01-01", last_sign_in_at: null, disabled_at: null, project_count: 0, property_count: 0 } as const;
    const now = Date.parse("2026-11-15");
    const rows: AdminUserRow[] = [
      { ...base, id: "1", plan: "PRO", plan_expires_at: "2026-12-01" },
      { ...base, id: "2", plan: "PRO", plan_expires_at: "2026-10-01" },
      { ...base, id: "3", plan: "BUSINESS", plan_expires_at: null },
      { ...base, id: "4", plan: "FREE" },
      { ...base, id: "5", role: "ADMIN", plan: "PRO" },
      { ...base, id: "6" },
    ];
    expect(adminStats(rows, now).paid).toBe(2);
  });
});
