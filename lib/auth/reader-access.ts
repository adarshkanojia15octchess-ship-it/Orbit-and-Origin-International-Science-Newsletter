import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated readers use the focused issue-library experience.
 * Anonymous visitors and the trusted founder may still read public About pages.
 */
export async function keepReaderInIssueLibrary() {
  let isReader = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const isFounder = Boolean(
      user &&
      user.app_metadata?.role === "admin" &&
      adminEmail &&
      user.email?.toLowerCase() === adminEmail
    );
    isReader = Boolean(user && !isFounder);
  } catch {
    // Public About pages remain available if auth services are temporarily unavailable.
  }
  if (isReader) redirect("/issues");
}
