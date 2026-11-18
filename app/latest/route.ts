import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("issues")
      .select("id")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) return new NextResponse("No published edition is available yet.", {
      status: 404, headers: { "Cache-Control": "no-store, max-age=0" },
    });
    return NextResponse.redirect(new URL("/reader/" + data.id, request.url), {
      status: 307, headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return new NextResponse("The latest edition could not be loaded. Please try again.", {
      status: 503, headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
