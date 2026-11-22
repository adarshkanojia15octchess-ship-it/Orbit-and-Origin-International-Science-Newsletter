import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCampaignEmail,
  buildCampaignIdempotencyKey,
  buildUnsubscribeToken,
  isRetryableResendError,
} from "@/src/editorial/newsletter-campaign.mjs";
import { processResendWebhookEvent } from "@/src/editorial/resend-webhook-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CAMPAIGN_WORKER_SECRET;
  const supplied = request.headers.get("authorization") || "";
  if (!secret || !supplied.startsWith("Bearer ")) return false;
  const expected = Buffer.from("Bearer " + secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

type ClaimedDelivery = { delivery_id: string; campaign_id: string };
type DeliveryDetails = {
  delivery_id: string;
  campaign_id: string;
  subscriber_id: string;
  recipient_email: string;
  first_name: string | null;
  campaign_subject: string;
  campaign_preheader: string;
  campaign_message: string;
  issue_title: string;
  issue_description: string;
  issue_number: number;
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const required = ["RESEND_API_KEY", "EMAIL_FROM", "NEXT_PUBLIC_SITE_URL", "UNSUBSCRIBE_SECRET", "RESEND_WEBHOOK_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    return NextResponse.json({ error: "Campaign delivery configuration is incomplete.", missing }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const apiKey = process.env.RESEND_API_KEY as string;
  const from = process.env.EMAIL_FROM as string;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL as string;
  const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET as string;
  const admin = createAdminClient();
  const resend = new Resend(apiKey);
  const claimToken = randomUUID();

  const { data: jobs, error: claimError } = await admin.rpc("claim_campaign_deliveries", {
    p_claim_token: claimToken,
    p_limit: 3,
    p_lease_seconds: 180,
  });
  if (claimError) {
    return NextResponse.json({ error: "Could not claim campaign deliveries." }, { status: 500 });
  }

  const totals = { claimed: (jobs || []).length, accepted: 0, retryScheduled: 0, failed: 0, suppressed: 0, webhookEventsReplayed: 0 };

  for (const job of (jobs || []) as ClaimedDelivery[]) {
    const { data: detailsRows, error: detailsError } = await admin.rpc("get_campaign_delivery_for_send", {
      p_delivery_id: job.delivery_id,
      p_claim_token: claimToken,
    });

    if (detailsError) {
      const { error } = await admin.rpc("fail_campaign_delivery", {
        p_delivery_id: job.delivery_id,
        p_claim_token: claimToken,
        p_error_message: "Could not load the claimed delivery",
        p_retryable: true,
      });
      if (error) return NextResponse.json({ error: "A delivery failure could not be recorded." }, { status: 500 });
      totals.retryScheduled += 1;
      continue;
    }

    const delivery = (detailsRows || [])[0] as DeliveryDetails | undefined;
    if (!delivery) {
      totals.suppressed += 1;
      continue;
    }

    const issueUrl = new URL("/issues/" + delivery.issue_number, baseUrl).toString();
    const token = buildUnsubscribeToken(delivery.subscriber_id, unsubscribeSecret);
    const unsubscribeUrl = new URL("/api/unsubscribe?token=" + encodeURIComponent(token), baseUrl).toString();
    const content = buildCampaignEmail({
      firstName: delivery.first_name || "",
      preheader: delivery.campaign_preheader,
      messageText: delivery.campaign_message,
      issueTitle: delivery.issue_title,
      issueDescription: delivery.issue_description,
      issueNumber: delivery.issue_number,
      issueUrl,
      unsubscribeUrl,
    });

    const idempotencyKey = buildCampaignIdempotencyKey(delivery.campaign_id, delivery.delivery_id);
    const { data: sent, error: sendError } = await resend.emails.send({
      from,
      to: [delivery.recipient_email],
      subject: delivery.campaign_subject,
      html: content.html,
      text: content.text,
      headers: {
        "List-Unsubscribe": "<" + unsubscribeUrl + ">",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }, { idempotencyKey });

    if (sendError) {
      const statusCode = Number(sendError.statusCode || 0);
      const retryable = isRetryableResendError(sendError);
      const safeError = statusCode ? "Resend returned HTTP " + statusCode : "Resend request failed";
      const { error } = await admin.rpc("fail_campaign_delivery", {
        p_delivery_id: delivery.delivery_id,
        p_claim_token: claimToken,
        p_error_message: safeError,
        p_retryable: retryable,
      });
      if (error) return NextResponse.json({ error: "A delivery failure could not be recorded." }, { status: 500 });
      if (retryable) totals.retryScheduled += 1;
      else totals.failed += 1;
      continue;
    }

    const providerMessageId = sent?.id;
    if (!providerMessageId) {
      const { error } = await admin.rpc("fail_campaign_delivery", {
        p_delivery_id: delivery.delivery_id,
        p_claim_token: claimToken,
        p_error_message: "Resend response did not include a message ID",
        p_retryable: true,
      });
      if (error) return NextResponse.json({ error: "The missing provider ID could not be recorded." }, { status: 500 });
      totals.retryScheduled += 1;
      continue;
    }

    const { data: completed, error: completeError } = await admin.rpc("complete_campaign_delivery", {
      p_delivery_id: delivery.delivery_id,
      p_claim_token: claimToken,
      p_provider_message_id: providerMessageId,
    });
    if (completeError || completed !== true) {
      // Let the lease expire; the next worker attempt reuses the same idempotency key.
      return NextResponse.json({ error: "Provider accepted a message but its delivery record could not be committed." }, { status: 503 });
    }
    totals.accepted += 1;

    // Replay a signed webhook that arrived before the send response was stored.
    const { data: pendingEvents } = await admin.from("email_webhook_events")
      .select("event_id,event_type,provider_message_id")
      .eq("provider_message_id", providerMessageId)
      .in("processing_status", ["received", "error"]);

    for (const event of pendingEvents || []) {
      try {
        if (await processResendWebhookEvent(admin, event)) totals.webhookEventsReplayed += 1;
      } catch {
        // Leave this event retryable for a later webhook delivery or worker pass.
      }
    }
  }

  // Retire unmatched non-campaign events after a day (e.g. subscription confirmations).
  await admin.from("email_webhook_events").update({
    processing_status: "processed",
    processed_at: new Date().toISOString(),
    last_error: "No campaign delivery matched within 24 hours",
  }).in("processing_status", ["received", "error"])
    .lt("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json(totals, { headers: { "Cache-Control": "no-store" } });
}
