import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { getPublisherCalendar } from "@/lib/publisher/dashboard";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export async function GET(request: NextRequest) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  if (!parsed.success || new Date(parsed.data.to).getTime() <= new Date(parsed.data.from).getTime()) {
    return NextResponse.json({ error: "Provide a valid from/to ISO-8601 range." }, { status: 400 });
  }
  if (new Date(parsed.data.to).getTime() - new Date(parsed.data.from).getTime() > 1000 * 60 * 60 * 24 * 366) {
    return NextResponse.json({ error: "Calendar range cannot exceed 366 days." }, { status: 400 });
  }

  try {
    const calendar = await getPublisherCalendar(context.supabase, parsed.data.from, parsed.data.to);
    return NextResponse.json(calendar, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Publication calendar is temporarily unavailable." }, { status: 500 });
  }
}
