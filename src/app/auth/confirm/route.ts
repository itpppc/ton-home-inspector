import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isEmailOtpType, safeNext } from "@/lib/auth/redirect";

/**
 * Email-link verification by token hash (signup confirm, password recovery).
 * Unlike the PKCE `code` flow, this works when the link is opened in another browser or
 * device than the one that requested it (e.g. signed up in LINE, opened the mail in Gmail app).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/");
  if (!isSupabaseConfigured || !tokenHash || !isEmailOtpType(type)) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, url.origin));
}
