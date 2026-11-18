import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { getPublisherOverview } from "@/lib/publisher/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const overview = await getPublisherOverview(context.supabase);
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Publisher overview is temporarily unavailable." }, { status: 500 });
  }
}
