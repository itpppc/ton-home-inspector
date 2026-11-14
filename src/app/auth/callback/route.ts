import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/redirect";

/** Exchanges the email-link code (signup confirm / password recovery) for a session. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (!isSupabaseConfigured || !code) return NextResponse.redirect(new URL("/login?error=link", url.origin));
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // PKCE needs the verifier cookie of the requesting browser. Opened elsewhere, the email is
  // already confirmed by Supabase, so send the user to sign in rather than "link expired".
  if (error) return NextResponse.redirect(new URL(next === "/reset-password" ? "/login?error=link" : "/login?error=other-browser", url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
