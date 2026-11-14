/** Maps Supabase auth errors to Thai copy without leaking whether an account exists. */
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("email not confirmed")) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (ตรวจสอบกล่องจดหมาย)";
  if (m.includes("already registered") || m.includes("already been registered")) return "อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ";
  if (m.includes("rate limit") || m.includes("too many")) return "ทำรายการบ่อยเกินไป กรุณารอสักครู่";
  if (m.includes("password")) return "รหัสผ่านไม่เป็นไปตามเงื่อนไข";
  if (m.includes("fetch") || m.includes("network")) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต";
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
