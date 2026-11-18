import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const supabase = await createClient();

  if (!code) {
    return NextResponse.redirect(new URL("/publisher?error=oauth", requestUrl.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/publisher?error=oauth", requestUrl.origin));
  }

  const { data } = await supabase.auth.getUser();
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isAuthorisedAdmin = Boolean(
    data.user &&
    data.user.app_metadata?.role === "admin" &&
    configuredAdminEmail &&
    data.user.email?.toLowerCase() === configuredAdminEmail
  );

  if (!isAuthorisedAdmin) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/publisher?error=unauthorised", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/publisher", requestUrl.origin));
}
