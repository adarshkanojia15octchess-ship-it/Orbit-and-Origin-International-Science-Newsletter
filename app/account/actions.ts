"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://orbit-and-origin-international-scie.vercel.app";
}
function validCredentials(email: string, password: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8 && password.length <= 256;
}

export async function signInReader(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!validCredentials(email, password)) redirect("/account?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/account?error=invalid");
  redirect("/issues");
}

export async function signUpReader(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!validCredentials(email, password)) redirect("/account?error=invalid");
  const supabase = await createClient();
  const emailRedirectTo = new URL("/auth/callback?mode=reader", siteUrl()).toString();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
  if (error) redirect("/account?error=signup");
  if (data.session) redirect("/issues");
  redirect("/account?check-email=1");
}

export async function signInReaderWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback?mode=reader", siteUrl()).toString(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/account?error=oauth");
  redirect(data.url);
}

export async function signOutReader() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/account");
}
