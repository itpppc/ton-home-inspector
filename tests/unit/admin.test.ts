import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUserRow } from "@/lib/domain/types";
import { adminApi, adminError, adminStats, filterUsers } from "@/features/admin/admin-users";

const NOW = new Date("2026-11-15T00:00:00Z").getTime();
const u = (p: Partial<AdminUserRow>): AdminUserRow => ({
  id: crypto.randomUUID(), email: "x@x.co", full_name: null, role: "INSPECTOR", created_at: "2026-01-01T00:00:00Z",
  last_sign_in_at: null, disabled_at: null, project_count: 0, property_count: 0, ...p,
});
const rows = [
  u({ email: "itpppc@gmail.com", full_name: "TON", role: "ADMIN", created_at: "2026-11-14T20:00:00Z", last_sign_in_at: "2026-11-14T20:20:00Z", project_count: 1, property_count: 1 }),
  u({ email: "buyer@mail.com", full_name: "ผู้ซื้อบ้าน", created_at: "2026-11-01T00:00:00Z", project_count: 2, property_count: 3 }),
  u({ email: "old@mail.com", role: "VIEWER", last_sign_in_at: "2026-05-01T00:00:00Z", disabled_at: "2026-11-10T00:00:00Z" }),
];

describe("admin dashboard helpers", () => {
  it("computes stats", () => {
    expect(adminStats(rows, NOW)).toEqual({ total: 3, newLast30: 2, activeLast30: 1, suspended: 1, admins: 1, projects: 3, properties: 4 });
    expect(adminStats([], NOW).total).toBe(0);
  });
  it("filters by role, suspension and Thai/English search", () => {
    expect(filterUsers(rows, "", "ADMIN").map((r) => r.email)).toEqual(["itpppc@gmail.com"]);
    expect(filterUsers(rows, "", "SUSPENDED").map((r) => r.email)).toEqual(["old@mail.com"]);
    expect(filterUsers(rows, "ผู้ซื้อ", "all")).toHaveLength(1);
    expect(filterUsers(rows, "  @MAIL.COM ", "all")).toHaveLength(2);
  });
  it("maps a missing migration to an actionable Thai message", () => {
    expect(adminError("Could not find the function public.admin_list_users without parameters in the schema cache")).toMatch(/migration 0006/);
    expect(adminError("เฉพาะผู้ดูแลระบบเท่านั้น")).toBe("เฉพาะผู้ดูแลระบบเท่านั้น");
  });
  it("calls the RPCs with the right arguments and surfaces errors", async () => {
    const calls: [string, unknown][] = [];
    const sb = { rpc: async (fn: string, args?: unknown) => { calls.push([fn, args]); return fn === "admin_set_user_role" ? { data: null, error: { message: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" } } : { data: [], error: null }; } } as unknown as SupabaseClient;
    const api = adminApi(sb);
    await expect(api.list()).resolves.toEqual([]);
    await api.setDisabled("u1", true);
    await expect(api.setRole("u1", "ADMIN")).rejects.toThrow("เปลี่ยนสิทธิ์ของตัวเองไม่ได้");
    expect(calls).toEqual([["admin_list_users", undefined], ["admin_set_user_disabled", { p_user: "u1", p_disabled: true }], ["admin_set_user_role", { p_user: "u1", p_role: "ADMIN" }]]);
  });
});
