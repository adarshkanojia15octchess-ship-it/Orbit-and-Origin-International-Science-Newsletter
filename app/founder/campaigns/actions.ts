"use server";

import { createHash } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCampaignEmail, buildTestIdempotencyKey } from "@/src/editorial/newsletter-campaign.mjs";

const campaignIdSchema = z.string().uuid();
const testSchema = z.object({ campaign_id: z.string().uuid(), test_email: z.string().trim().email().max(254) });

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function queueConfigurationReady() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.EMAIL_FROM &&
    process.env.NEXT_PUBLIC_SITE_URL &&
    process.env.UNSUBSCRIBE_SECRET &&
    process.env.CAMPAIGN_WORKER_SECRET &&
    process.env.RESEND_WEBHOOK_SECRET
  );
}

export async function createCampaign(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");

  const parsed = z.object({
    issue_id: z.string().uuid(),
    subject: z.string().trim().min(3).max(160),
    preheader: z.string().trim().max(180).default(""),
    message_text: z.string().trim().min(10).max(8000),
  }).safeParse({
    issue_id: formData.get("issue_id"),
    subject: formData.get("subject"),
    preheader: formData.get("preheader") || "",
    message_text: formData.get("message_text"),
  });
  if (!parsed.success) redirect("/founder/campaigns?error=invalid");

  const admin = createAdminClient();
  const { data: issue, error: issueError } = await admin.from("issues")
    .select("id").eq("id", parsed.data.issue_id).eq("status", "published").maybeSingle();
  if (issueError || !issue) redirect("/founder/campaigns?error=issue");

  const { error } = await admin.from("campaigns").insert({
    issue_id: parsed.data.issue_id,
    subject: parsed.data.subject,
    preheader: parsed.data.preheader,
    message_text: parsed.data.message_text,
    status: "draft",
  });
  if (error) redirect("/founder/campaigns?error=create");
  revalidatePath("/founder/campaigns");
  redirect("/founder/campaigns?created=1");
}

export async function sendCampaignTest(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");

  const parsed = testSchema.safeParse({ campaign_id: formData.get("campaign_id"), test_email: formData.get("test_email") });
  if (!parsed.success) redirect("/founder/campaigns?error=test-email");

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !baseUrl) redirect("/founder/campaigns?error=resend-config");

  const admin = createAdminClient();
  const { data: campaign, error: campaignError } = await admin.from("campaigns")
    .select("id,issue_id,subject,preheader,message_text,status")
    .eq("id", parsed.data.campaign_id).maybeSingle();
  if (campaignError || !campaign || campaign.status !== "draft") redirect("/founder/campaigns?error=campaign-state");

  const { data: issue, error: issueError } = await admin.from("issues")
    .select("issue_number,title,description,status").eq("id", campaign.issue_id).maybeSingle();
  if (issueError || !issue || issue.status !== "published") redirect("/founder/campaigns?error=issue");

  const recipientHash = hash(parsed.data.test_email.toLowerCase());
  const contentHash = hash(JSON.stringify([campaign.subject, campaign.preheader, campaign.message_text, issue.title, issue.description, issue.issue_number]));
  const idempotencyKey = buildTestIdempotencyKey(campaign.id, recipientHash, contentHash);
  const issueUrl = new URL("/issues/" + issue.issue_number, baseUrl).toString();
  const email = buildCampaignEmail({
    preheader: campaign.preheader,
    messageText: campaign.message_text,
    issueTitle: issue.title,
    issueDescription: issue.description,
    issueNumber: issue.issue_number,
    issueUrl,
    testMode: true,
  });

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from, to: [parsed.data.test_email], subject: campaign.subject, html: email.html, text: email.text,
  }, { idempotencyKey });
  if (sendError) redirect("/founder/campaigns?error=test-send");

  const { error: updateError } = await admin.from("campaigns").update({
    test_sent_at: new Date().toISOString(),
    test_recipient_hash: recipientHash,
    last_error: null,
  }).eq("id", campaign.id).eq("status", "draft");
  if (updateError) redirect("/founder/campaigns?error=test-log");

  revalidatePath("/founder/campaigns");
  redirect("/founder/campaigns?tested=1");
}

export async function queueCampaign(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");

  const campaignId = String(formData.get("campaign_id") || "");
  if (!campaignIdSchema.safeParse(campaignId).success) redirect("/founder/campaigns?error=invalid");
  if (!queueConfigurationReady()) redirect("/founder/campaigns?error=queue-config");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("queue_campaign_deliveries", { p_campaign_id: campaignId });
  if (error) redirect("/founder/campaigns?error=queue");

  const result = data as { ok?: boolean; reason?: string; queued_count?: number } | null;
  if (!result?.ok) {
    const reason = result?.reason === "no_active_subscribers" ? "empty-list"
      : result?.reason === "test_send_required" ? "test-required"
      : result?.reason === "issue_not_published" ? "issue"
      : "campaign-state";
    redirect("/founder/campaigns?error=" + reason);
  }

  revalidatePath("/founder/campaigns");
  redirect("/founder/campaigns?queued=" + String(result.queued_count || 0));
}

export async function retryFailedCampaignDeliveries(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");

  const campaignId = String(formData.get("campaign_id") || "");
  if (!campaignIdSchema.safeParse(campaignId).success) redirect("/founder/campaigns?error=invalid");
  if (!queueConfigurationReady()) redirect("/founder/campaigns?error=queue-config");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("retry_failed_campaign_deliveries", { p_campaign_id: campaignId });
  if (error) redirect("/founder/campaigns?error=retry");
  if (data !== true) redirect("/founder/campaigns?error=retry-window");

  revalidatePath("/founder/campaigns");
  redirect("/founder/campaigns?retried=1");
}
