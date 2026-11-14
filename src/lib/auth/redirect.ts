/** Only same-origin relative paths are allowed as post-auth destinations (prevents open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export const EMAIL_OTP_TYPES = ["email", "signup", "recovery", "invite", "magiclink", "email_change"] as const;
export type EmailOtpTypeName = (typeof EMAIL_OTP_TYPES)[number];
export const isEmailOtpType = (t: string | null): t is EmailOtpTypeName => !!t && (EMAIL_OTP_TYPES as readonly string[]).includes(t);
