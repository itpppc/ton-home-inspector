/** Membership plans (migration 0007). The server enforces every limit; this module only mirrors it for UX. */
export type PlanTier = "FREE" | "PRO" | "BUSINESS";
export type BillingPeriod = "month" | "year";
export type QuotaKind = "projects" | "properties" | "members";

export interface PlanRow {
  tier: PlanTier;
  name: string;
  description: string;
  price_thb: number;
  /** Price applies per month or per year; also the default extension the admin grants. */
  billing_period: BillingPeriod;
  max_projects: number | null;
  max_properties: number | null;
  max_members: number | null;
  features: string[];
  sort_order: number;
}

/** Shape of public.my_plan(). `null` limit = unlimited. */
export interface MyPlan {
  plan: PlanTier;
  plan_expires_at: string | null;
  effective: PlanTier;
  unlimited: boolean;
  max_projects: number | null;
  max_properties: number | null;
  max_members: number | null;
  projects: number;
  properties: number;
}

/** Offline / pre-migration fallback — keep in sync with the seed in 20261115000007_plans.sql. */
export const DEFAULT_PLANS: PlanRow[] = [
  { tier: "FREE", name: "Free", description: "ผู้ซื้อบ้านที่ตรวจบ้านของตัวเอง 1 หลัง", price_thb: 0, billing_period: "month", max_projects: 1, max_properties: 1, max_members: 2,
    features: ["ตรวจบ้าน 1 หลัง", "Checklist มาตรฐาน 180+ รายการ", "ถ่ายรูป / Defect / ตรวจซ้ำ", "ใช้งานออฟไลน์", "รายงาน PDF และ Excel", "แชร์ให้ผู้ร่วมดู 1 คน"], sort_order: 1 },
  { tier: "PRO", name: "Pro", description: "นักลงทุน / ผู้ซื้อหลายหลัง / นายหน้า", price_thb: 99, billing_period: "month", max_projects: 5, max_properties: 10, max_members: 5,
    features: ["สูงสุด 5 โครงการ 10 หลัง", "ทุกอย่างใน Free", "ทีมร่วมโครงการได้ 5 คน", "สำรองข้อมูลบน Cloud"], sort_order: 2 },
  { tier: "BUSINESS", name: "Business", description: "บริษัทรับตรวจบ้าน / ผู้รับเหมา / นิติบุคคล", price_thb: 299, billing_period: "year", max_projects: null, max_properties: null, max_members: 50,
    features: ["โครงการและบ้านไม่จำกัด", "ทีมผู้ตรวจได้ 50 คนต่อโครงการ", "สิทธิ์ Admin / Inspector / Viewer", "รายงานแบรนด์ TON AI สำหรับลูกค้า"], sort_order: 3 },
];

export const PLAN_TIERS: PlanTier[] = ["FREE", "PRO", "BUSINESS"];
export const QUOTA_LABEL: Record<QuotaKind, { noun: string; unit: string }> = {
  projects: { noun: "โครงการ", unit: "โครงการ" },
  properties: { noun: "บ้าน", unit: "หลัง" },
  members: { noun: "สมาชิกต่อโครงการ", unit: "คน" },
};

export interface Quota {
  allowed: boolean;
  used: number;
  /** null = unlimited */
  limit: number | null;
}

/** Can one more `kind` be created? `used` comes from the local DB so it is correct offline. */
export function checkQuota(plan: MyPlan | null, kind: QuotaKind, used: number): Quota {
  const limit = !plan || plan.unlimited ? null : plan[`max_${kind}`];
  return { allowed: limit === null || used < limit, used, limit };
}

export function formatLimit(limit: number | null, unit: string): string {
  return limit === null ? "ไม่จำกัด" : `${limit.toLocaleString("th-TH")} ${unit}`;
}

export function formatPrice(thb: number): string {
  return thb === 0 ? "ฟรี" : `฿${thb.toLocaleString("th-TH")}`;
}

export const PERIOD_LABEL: Record<BillingPeriod, string> = { month: "เดือน", year: "ปี" };
/** Months an admin grants by default for one payment of this plan. */
export const periodMonths = (p: BillingPeriod) => (p === "year" ? 12 : 1);

/** Whole days until expiry (negative = expired), or null for no expiry. */
export function daysLeft(expiresAt: string | null, now = Date.now()): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000);
}

/** The paid plan has lapsed: the server already treats the user as FREE. */
export const isExpired = (p: MyPlan | null) => !!p && p.plan !== "FREE" && p.effective !== p.plan;

const PLAN_LIMIT_RE = /PLAN_LIMIT:(projects|properties|members):(\d+)/;

/** Turns the server's PLAN_LIMIT exception into a Thai sentence; other messages pass through. */
export function friendlyServerError(message: string): string {
  const m = PLAN_LIMIT_RE.exec(message);
  if (!m) return message;
  const { noun, unit } = QUOTA_LABEL[m[1] as QuotaKind];
  return `เกินสิทธิ์แพ็กเกจ: ${noun}สูงสุด ${m[2]} ${unit} — อัปเกรดแพ็กเกจที่หน้า “แพ็กเกจ”`;
}

export const isPlanLimitError = (message: string | null | undefined) => !!message && PLAN_LIMIT_RE.test(message);

/** Renewal base: extend from the current expiry if it is still in the future, else from today. */
export function renewFrom(expiresAt: string | null | undefined, now = new Date()): Date {
  const cur = expiresAt ? new Date(expiresAt) : null;
  return cur && cur > now ? cur : now;
}

/** `yyyy-mm-dd` (local) of `base` + n months, clamped to the month's last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsISODate(base: Date, months: number): string {
  const y = base.getFullYear(), m = base.getMonth() + months, d = base.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  const r = new Date(y, m, Math.min(d, last));
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, "0")}-${String(r.getDate()).padStart(2, "0")}`;
}

/** End of the chosen local day, as ISO — a plan "valid until 2026-12-31" lasts through that whole day. */
export const endOfLocalDayISO = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T23:59:59`).toISOString();
