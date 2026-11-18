import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const mode = requestUrl.searchParams.get("mode");
  const supabase = await createClient();
  const go = (path: string) => NextResponse.redirect(new URL(path, requestUrl.origin));

  if (!code) return go(mode === "reader" ? "/account?error=oauth" : "/founder/portal?error=oauth");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return go(mode === "reader" ? "/account?error=oauth" : "/founder/portal?error=oauth");

  const { data } = await supabase.auth.getUser();
  if (mode === "reader") {
    // Ordinary reader sign-in never assigns administrator metadata.
    if (!data.user) {
      await supabase.auth.signOut();
      return go("/account?error=oauth");
    }
    return go("/account?welcome=1");
  }

  // Default and explicit admin callbacks retain strict trusted-role and email checks.
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const authorised = Boolean(data.user && data.user.app_metadata?.role === "admin" &&
    allowedEmail && data.user.email?.toLowerCase() === allowedEmail);
  if (!authorised) {
    await supabase.auth.signOut();
    return go("/founder/portal?error=unauthorised");
  }
  return go("/founder/portal");
}
