"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInAdmin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) redirect("/admin/login?error=configuration");
  if (email !== allowedEmail || !password || password.length > 256) redirect("/admin/login?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/admin/login?error=invalid");
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.app_metadata?.role !== "admin" || data.user.email?.toLowerCase() !== allowedEmail) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorised");
  }
  redirect("/founder/portal");
}

export async function signInWithGoogle() {
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://orbit-and-origin-international-scie.vercel.app";
  if (!allowedEmail) redirect("/admin/login?error=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback?mode=admin", siteUrl).toString(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/admin/login?error=oauth");
  redirect(data.url);
}

export async function signOutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/founder/portal");
}
