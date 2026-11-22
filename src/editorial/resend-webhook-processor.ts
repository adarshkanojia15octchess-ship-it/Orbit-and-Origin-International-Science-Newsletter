import type { SupabaseClient } from "@supabase/supabase-js";

export type StoredResendWebhookEvent = {
  event_id: string;
  event_type: string;
  provider_message_id: string | null;
};

export async function processResendWebhookEvent(admin: SupabaseClient, event: StoredResendWebhookEvent): Promise<boolean> {
  if (!event.provider_message_id) {
    const { error } = await admin.from("email_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("event_id", event.event_id);
    if (error) throw error;
    return true;
  }

  const { data: delivery, error: lookupError } = await admin.from("email_deliveries")
    .select("id,subscriber_id,delivery_status")
    .eq("provider_message_id", event.provider_message_id)
    .maybeSingle();

  if (lookupError) throw lookupError;
  // A webhook can arrive just before the worker persists Resend's message ID.
  // Leave unmatched events pending for replay after the provider response commits.
  if (!delivery) return false;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    last_provider_event: event.event_type,
    last_provider_event_at: now,
  };

  switch (event.event_type) {
    case "email.sent":
      if (["queued", "sending"].includes(delivery.delivery_status)) update.delivery_status = "sent";
      break;
    case "email.delivered":
      update.delivery_status = "delivered";
      update.sent_at = now;
      update.error_message = null;
      break;
    case "email.bounced":
      update.delivery_status = "bounced";
      update.error_message = "Resend reported a permanent bounce";
      break;
    case "email.complained":
      update.delivery_status = "complained";
      update.error_message = "Recipient reported the message as spam";
      break;
    case "email.failed":
      if (!["delivered", "bounced", "complained", "suppressed"].includes(delivery.delivery_status)) {
        update.delivery_status = "failed";
        update.error_message = "Resend reported a message failure";
      }
      break;
    case "email.suppressed":
      if (!["delivered", "bounced", "complained"].includes(delivery.delivery_status)) update.delivery_status = "suppressed";
      break;
    case "email.delivery_delayed":
    case "email.opened":
    case "email.clicked":
      // Resend retries temporary delivery delays itself; don't treat a soft bounce as final.
      break;
    default:
      break;
  }

  const { error: deliveryUpdateError } = await admin.from("email_deliveries").update(update).eq("id", delivery.id);
  if (deliveryUpdateError) throw deliveryUpdateError;

  if (event.event_type === "email.bounced" && delivery.subscriber_id) {
    const { error } = await admin.from("subscribers").update({
      subscription_status: "bounced",
      updated_at: now,
    }).eq("id", delivery.subscriber_id).in("subscription_status", ["active", "pending"]);
    if (error) throw error;
  }

  if (event.event_type === "email.complained" && delivery.subscriber_id) {
    const { error } = await admin.from("subscribers").update({
      subscription_status: "unsubscribed",
      unsubscribed_at: now,
      updated_at: now,
    }).eq("id", delivery.subscriber_id).neq("subscription_status", "unsubscribed");
    if (error) throw error;
  }

  const { error: eventUpdateError } = await admin.from("email_webhook_events").update({
    processing_status: "processed",
    processed_at: now,
    last_error: null,
  }).eq("event_id", event.event_id);
  if (eventUpdateError) throw eventUpdateError;
  return true;
}
