/**
 * Defect-claim deadline: "แจ้งเก็บงาน 1 ครั้ง ภายใน N วันนับจากวันจดทะเบียนโอนกรรมสิทธิ์".
 * Counting follows Thai Civil and Commercial Code s.193/3: the transfer day itself is
 * excluded, so day 1 is the day after transfer and the last day = transfer + N.
 * Only the ACTUAL transfer date (entered by the user) starts the clock; the planned
 * date from the booking document is shown as a reference and never used to compute it.
 */

export type DeadlineState = "NO_ACTUAL_DATE" | "NOT_STARTED" | "OPEN" | "URGENT" | "LAST_DAY" | "EXPIRED";

export interface DeadlineInfo {
  state: DeadlineState;
  transferDate: string | null;
  deadline: string | null;
  daysRemaining: number | null;
  plannedDate: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date in Bangkok, YYYY-MM-DD. */
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isValidIsoDate(date: string | null | undefined): date is string {
  if (!date || !ISO_DATE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const back = new Date(Date.UTC(y, m - 1, d));
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}

function toDayNumber(date: string): number {
  if (!ISO_DATE.test(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) throw new Error(`Invalid date: ${date}`);
  return Math.round(t / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const n = toDayNumber(date) + days;
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

export const URGENT_THRESHOLD_DAYS = 3;

export function computeClaimDeadline(input: {
  transferDateActual: string | null | undefined;
  transferDatePlanned?: string | null;
  windowDays?: number | null;
  today?: string;
}): DeadlineInfo {
  const plannedDate = isValidIsoDate(input.transferDatePlanned) ? input.transferDatePlanned : null;
  const transfer = isValidIsoDate(input.transferDateActual) ? input.transferDateActual : null;
  if (!transfer) return { state: "NO_ACTUAL_DATE", transferDate: null, deadline: null, daysRemaining: null, plannedDate };

  const windowDays = input.windowDays && input.windowDays > 0 ? Math.floor(input.windowDays) : 15;
  const today = input.today ?? todayInBangkok();
  const deadline = addDays(transfer, windowDays);
  const daysRemaining = diffDays(today, deadline);

  let state: DeadlineState;
  if (diffDays(today, transfer) > 0) state = "NOT_STARTED";
  else if (daysRemaining < 0) state = "EXPIRED";
  else if (daysRemaining === 0) state = "LAST_DAY";
  else if (daysRemaining <= URGENT_THRESHOLD_DAYS) state = "URGENT";
  else state = "OPEN";

  return { state, transferDate: transfer, deadline, daysRemaining, plannedDate };
}
