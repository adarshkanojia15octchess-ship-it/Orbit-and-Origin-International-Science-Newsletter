import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });

  try {
    const admin = createAdminClient();
    const columns = ["email", "first_name", "subscription_status", "consent_at", "subscribed_at", "confirmed_at", "unsubscribed_at"] as const;
    const rows: string[] = [columns.join(",")];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await admin.from("subscribers")
        .select(columns.join(","))
        .order("subscribed_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = data || [];
      for (const row of page) rows.push(columns.map((column) => csvCell(row[column])).join(","));
      if (page.length < pageSize) break;
      offset += pageSize;
      if (offset >= 100000) {
        return NextResponse.json({ error: "Export exceeds the 100,000-record safety limit." }, { status: 413, headers: { "Cache-Control": "no-store" } });
      }
    }

    const date = new Date().toISOString().slice(0, 10);
    const csv = "\uFEFF" + rows.join("\r\n") + "\r\n";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=orbit-origin-subscribers-" + date + ".csv",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Subscriber export is temporarily unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
