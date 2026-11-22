"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";

export async function deleteSubscriber(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");

  const subscriberId = String(formData.get("subscriber_id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(subscriberId)) redirect("/founder/subscribers?error=invalid");

  const admin = createAdminClient();
  const { data, error } = await admin.from("subscribers")
    .delete().eq("id", subscriberId).select("id").maybeSingle();

  if (error || !data) redirect("/founder/subscribers?error=delete");
  revalidatePath("/founder/subscribers");
  revalidatePath("/founder/campaigns");
  redirect("/founder/subscribers?deleted=1");
}
