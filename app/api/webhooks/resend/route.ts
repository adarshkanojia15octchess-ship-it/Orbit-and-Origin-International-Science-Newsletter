import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { processResendWebhookEvent } from "@/src/editorial/resend-webhook-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEvent = { type: string; data?: { email_id?: string; id?: string } };

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 503 });
  }

  const eventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!eventId || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 400 });
  }

  const payload = await request.text();
  let event: ResendEvent;
  try {
    const resend = new Resend(apiKey);
    event = resend.webhooks.verify({
      payload,
      headers: { "svix-id": eventId, "svix-timestamp": timestamp, "svix-signature": signature },
      secret: webhookSecret,
    }) as unknown as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const providerMessageId = event.data?.email_id || event.data?.id || null;
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("email_webhook_events").insert({
    event_id: eventId,
    event_type: event.type,
    provider_message_id: providerMessageId,
    processing_status: "received",
  });

  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Webhook event could not be recorded." }, { status: 500 });
  }

  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await admin.from("email_webhook_events")
      .select("processing_status,event_type,provider_message_id,event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: "Webhook event could not be read." }, { status: 500 });
    if (existing?.processing_status === "processed") {
      return new NextResponse("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
    }
    if (existing) event = { type: existing.event_type, data: { email_id: existing.provider_message_id || undefined } };
  }

  try {
    await processResendWebhookEvent(admin, {
      event_id: eventId,
      event_type: event.type,
      provider_message_id: event.data?.email_id || event.data?.id || null,
    });
  } catch {
    await admin.from("email_webhook_events").update({
      processing_status: "error",
      last_error: "Verified webhook event processing failed",
    }).eq("event_id", eventId);
    return NextResponse.json({ error: "Webhook event processing failed." }, { status: 500 });
  }

  // Valid events without a matched campaign delivery remain pending for worker replay.
  return new NextResponse("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
}
