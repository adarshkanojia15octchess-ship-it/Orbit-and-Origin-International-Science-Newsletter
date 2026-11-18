import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function LegacyPublisherEntry() {
  const context = await getAdminContext();
  if (!context) redirect("/issues");
  redirect("/founder/portal");
}
