import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("issues")
      .select("pdf_url")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!data?.pdf_url || !isPublishedStorageAsset(data.pdf_url, projectUrl)) {
      return new NextResponse("No published issue PDF is available.", {
        status: 404, headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    return NextResponse.redirect(data.pdf_url, {
      status: 307,
      headers: { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "strict-origin-when-cross-origin" },
    });
  } catch {
    return new NextResponse("The latest issue PDF could not be loaded. Please try again.", {
      status: 503, headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
