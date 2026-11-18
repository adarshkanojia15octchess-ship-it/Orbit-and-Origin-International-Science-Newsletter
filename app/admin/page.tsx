import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Founder Publishing Desk" };

export default async function AdminDashboardPage() {
  let context;
  try {
    context = await getAdminContext();
  } catch {
    redirect("/admin/login?error=configuration");
  }
  if (!context) redirect("/admin/login");
  redirect("/founder/portal");
}
