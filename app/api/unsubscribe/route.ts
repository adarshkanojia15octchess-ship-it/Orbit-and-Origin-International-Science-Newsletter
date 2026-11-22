import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const NO_STORE = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer" };

/**
 * Email clients and security scanners may prefetch ordinary links.
 * GET therefore only opens the confirmation page; it never changes consent.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.redirect(new URL("/unsubscribe?status=invalid", request.url), {
      headers: NO_STORE,
    });
  }

  const confirmationUrl = new URL("/unsubscribe", request.url);
  confirmationUrl.searchParams.set("token", token);
  return NextResponse.redirect(confirmationUrl, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse("Invalid unsubscribe request.", {
      status: 400,
      headers: NO_STORE,
    });
  }

  // RFC 8058 one-click requests carry this field in the form body while the
  // token travels in the List-Unsubscribe URL's query string.
  const oneClick = form.get("List-Unsubscribe") === "One-Click";
  const token = String(
    form.get("token") || request.nextUrl.searchParams.get("token") || "",
  );

  if (!TOKEN_PATTERN.test(token)) {
    if (oneClick) {
      return new NextResponse("Invalid unsubscribe token.", { status: 400, headers: NO_STORE });
    }
    return NextResponse.redirect(new URL("/unsubscribe?status=invalid", request.url), {
      headers: NO_STORE,
    });
  }

  try {
    const admin = createAdminClient();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: subscriber, error } = await admin
      .from("subscribers")
      .select("id, subscription_status")
      .eq("unsubscribe_token_hash", tokenHash)
      .maybeSingle();

    if (error || !subscriber) {
      if (oneClick) {
        return new NextResponse("Invalid unsubscribe token.", { status: 400, headers: NO_STORE });
      }
      return NextResponse.redirect(new URL("/unsubscribe?status=invalid", request.url), {
        headers: NO_STORE,
      });
    }

    if (subscriber.subscription_status !== "unsubscribed") {
      const { error: updateError } = await admin
        .from("subscribers")
        .update({
          subscription_status: "unsubscribed",
          unsubscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriber.id)
        .neq("subscription_status", "unsubscribed");

      if (updateError) {
        if (oneClick) {
          return new NextResponse("Could not process unsubscribe request.", {
            status: 500,
            headers: NO_STORE,
          });
        }
        return NextResponse.redirect(new URL("/unsubscribe?status=error", request.url), {
          headers: NO_STORE,
        });
      }
    }

    // Providers expect a successful 2xx response to the RFC 8058 POST,
    // not a redirect to an HTML confirmation page.
    if (oneClick) {
      return new NextResponse("OK", { status: 200, headers: NO_STORE });
    }

    return NextResponse.redirect(new URL("/unsubscribe?status=success", request.url), {
      headers: NO_STORE,
    });
  } catch {
    if (oneClick) {
      return new NextResponse("Could not process unsubscribe request.", {
        status: 500,
        headers: NO_STORE,
      });
    }
    return NextResponse.redirect(new URL("/unsubscribe?status=error", request.url), {
      headers: NO_STORE,
    });
  }
}
