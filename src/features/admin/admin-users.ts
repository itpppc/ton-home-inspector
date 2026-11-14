import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUserRow, Role } from "@/lib/domain/types";
import type { PlanTier } from "@/features/plans/plans";

/** Thin, typed wrappers over the admin RPCs (all authorization is enforced in Postgres). */
export const adminApi = (sb: SupabaseClient) => ({
  async list(): Promise<AdminUserRow[]> {
    const { data, error } = await sb.rpc("admin_list_users");
    if (error) throw new Error(adminError(error.message));
    return (data ?? []) as AdminUserRow[];
  },
  async setRole(userId: string, role: Role) {
    const { error } = await sb.rpc("admin_set_user_role", { p_user: userId, p_role: role });
    if (error) throw new Error(adminError(error.message));
  },
  async setDisabled(userId: string, disabled: boolean) {
    const { error } = await sb.rpc("admin_set_user_disabled", { p_user: userId, p_disabled: disabled });
    if (error) throw new Error(adminError(error.message));
  },
  /** `expiresAt` null = no expiry. FREE always clears the expiry server-side. */
  async setPlan(userId: string, tier: PlanTier, expiresAt: string | null) {
    const { error } = await sb.rpc("admin_set_user_plan", { p_user: userId, p_tier: tier, p_expires_at: expiresAt });
    if (error) throw new Error(adminError(error.message));
  },
});

export function adminError(message: string): string {
  if (/could not find the function|schema cache/i.test(message)) return "ฐานข้อมูลยังไม่ได้อัปเดต (migration 0006–0007) กรุณารัน SQL ใน Supabase";
  if (/fetch|network/i.test(message)) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต";
  return message;
}

export interface AdminStats {
  total: number;
  newLast30: number;
  activeLast30: number;
  suspended: number;
  admins: number;
  /** Users on an active paid plan. */
  paid: number;
  projects: number;
  properties: number;
}

const DAY = 86_400_000;

export function adminStats(rows: AdminUserRow[], now = Date.now()): AdminStats {
  const within30 = (iso: string | null) => !!iso && now - new Date(iso).getTime() <= 30 * DAY;
  return {
    total: rows.length,
    newLast30: rows.filter((r) => within30(r.created_at)).length,
    activeLast30: rows.filter((r) => within30(r.last_sign_in_at)).length,
    suspended: rows.filter((r) => r.disabled_at).length,
    admins: rows.filter((r) => r.role === "ADMIN").length,
    paid: rows.filter((r) => r.role !== "ADMIN" && r.plan && r.plan !== "FREE" && (!r.plan_expires_at || new Date(r.plan_expires_at).getTime() > now)).length,
    projects: rows.reduce((n, r) => n + r.project_count, 0),
    properties: rows.reduce((n, r) => n + r.property_count, 0),
  };
}

export type AdminFilter = "all" | Role | "SUSPENDED";

export function filterUsers(rows: AdminUserRow[], query: string, filter: AdminFilter): AdminUserRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) =>
    (filter === "all" || (filter === "SUSPENDED" ? !!r.disabled_at : r.role === filter)) &&
    (!q || `${r.email ?? ""} ${r.full_name ?? ""}`.toLowerCase().includes(q)),
  );
}
