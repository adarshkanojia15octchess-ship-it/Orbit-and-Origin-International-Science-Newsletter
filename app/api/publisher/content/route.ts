import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.enum(["issues", "articles"]),
  status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

export async function GET(request: NextRequest) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse({
    type: request.nextUrl.searchParams.get("type"),
    status: request.nextUrl.searchParams.get("status") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || 25,
    offset: request.nextUrl.searchParams.get("offset") || 0,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid content query." }, { status: 400 });

  const { type, status, limit, offset } = parsed.data;
  const table = type === "issues" ? "issues" : "articles";
  const columns = type === "issues"
    ? "id, issue_number, title, description, publication_date, scheduled_at, status, updated_at"
    : "id, headline, author, department, issue_id, scheduled_at, published_at, status, updated_at";

  let query = context.supabase.from(table).select(columns, { count: "exact" });
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: "Editorial records could not be loaded." }, { status: 500 });
  return NextResponse.json({ items: data ?? [], total: count ?? 0, limit, offset }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
