import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCampaignEmail,
  buildCampaignIdempotencyKey,
  buildTestIdempotencyKey,
  buildUnsubscribeToken,
  escapeCampaignHtml,
  getResendRetryDelaySeconds,
  isRetryableResendError,
} from "../src/editorial/newsletter-campaign.mjs";

const migration = readFileSync(new URL("../supabase/migrations/007_newsletter_campaign_operations.sql", import.meta.url), "utf8");
const worker = readFileSync(new URL("../app/api/cron/campaign-deliveries/route.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../app/api/webhooks/resend/route.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../app/api/founder/subscribers/export/route.ts", import.meta.url), "utf8");
const deleteAction = readFileSync(new URL("../app/founder/subscribers/actions.ts", import.meta.url), "utf8");
const unsubscribeRoute = readFileSync(new URL("../app/api/unsubscribe/route.ts", import.meta.url), "utf8");

test("campaign email escapes author-controlled content and links", () => {
  assert.equal(escapeCampaignHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  const email = buildCampaignEmail({
    preheader: "A <b>new</b> edition",
    messageText: "Look <script>not code</script>\n\nA second paragraph",
    issueTitle: "A <cosmic> title",
    issueDescription: "Description & details",
    issueNumber: 5,
    issueUrl: "https://example.org/issues/5?x=<y>",
    unsubscribeUrl: "https://example.org/api/unsubscribe?token=abc",
  });
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;not code&lt;\/script&gt;/);
  assert.match(email.html, /Unsubscribe/);
  assert.match(email.text, /Unsubscribe:/);
});

test("campaign idempotency keys are stable per persisted delivery", () => {
  const key = buildCampaignIdempotencyKey("campaign-a", "delivery-b");
  assert.equal(key, buildCampaignIdempotencyKey("campaign-a", "delivery-b"));
  assert.notEqual(key, buildCampaignIdempotencyKey("campaign-a", "delivery-c"));
  assert.equal(buildTestIdempotencyKey("campaign-a", "recipient", "content"), "campaign-test/campaign-a/recipient/content");
});

test("unsubscribe tokens use the existing subscriber HMAC format", () => {
  const first = buildUnsubscribeToken("subscriber-a", "secret-a");
  assert.equal(first, buildUnsubscribeToken("subscriber-a", "secret-a"));
  assert.notEqual(first, buildUnsubscribeToken("subscriber-a", "secret-b"));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("retry backoff is bounded", () => {
  assert.equal(getResendRetryDelaySeconds(1), 60);
  assert.equal(getResendRetryDelaySeconds(2), 120);
  assert.equal(getResendRetryDelaySeconds(5), 900);
  assert.equal(getResendRetryDelaySeconds(50), 900);
});

test("only rate limits, server errors and unknown network errors retry automatically", () => {
  assert.equal(isRetryableResendError({ statusCode: 429 }), true);
  assert.equal(isRetryableResendError({ statusCode: 503 }), true);
  assert.equal(isRetryableResendError(new Error("network timeout")), true);
  assert.equal(isRetryableResendError({ statusCode: 422 }), false);
});

test("database queue claims are exclusive, leased and retry bounded", () => {
  assert.match(migration, /for update of d skip locked/i);
  assert.match(migration, /locked_until/);
  assert.match(migration, /attempt_count < 5/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /on delete set null/i);
  assert.match(migration, /subscription_status in \('unsubscribed', 'bounced'\)/i);
  assert.match(migration, /grant execute on function public\.claim_campaign_deliveries[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function public\.queue_campaign_deliveries[\s\S]*from public, anon, authenticated/i);
});

test("worker rechecks consent and sends with a stable provider key and one-click unsubscribe", () => {
  assert.match(worker, /get_campaign_delivery_for_send/);
  assert.match(worker, /buildCampaignIdempotencyKey/);
  assert.match(worker, /idempotencyKey/);
  assert.match(worker, /List-Unsubscribe-Post/);
  assert.match(worker, /CAMPAIGN_WORKER_SECRET/);
});

test("Resend webhook verifies the raw signed payload and deduplicates event IDs", () => {
  assert.match(webhook, /await request\.text\(\)/);
  assert.match(webhook, /resend\.webhooks\.verify/);
  assert.match(webhook, /svix-id/);
  assert.match(webhook, /email_webhook_events/);
  assert.match(webhook, /23505/);
});

test("subscriber CSV export omits confirmation and unsubscribe credentials", () => {
  assert.match(exportRoute, /subscription_status/);
  assert.match(exportRoute, /consent_at/);
  assert.doesNotMatch(exportRoute, /confirmation_token_hash|unsubscribe_token_hash|confirmation_expires_at/);
});

test("subscriber deletion is administrator-gated", () => {
  assert.match(deleteAction, /getAdminContext/);
  assert.match(deleteAction, /\.from\("subscribers"\)[\s\S]*\.delete\(\)/);
});

test("one-click unsubscribe reads the RFC 8058 token from the query string", () => {
  assert.match(unsubscribeRoute, /request\.nextUrl\.searchParams\.get\("token"\)/);
  assert.match(unsubscribeRoute, /form\.get\("List-Unsubscribe"\)\s*===\s*"One-Click"/);
  assert.match(unsubscribeRoute, /new NextResponse\("OK", \{ status: 200/);
});

test("ordinary unsubscribe link GET is read-only and opens a confirmation page", () => {
  const getHandler = unsubscribeRoute.match(/export async function GET[\s\S]*?(?=export async function POST)/)?.[0] || "";
  assert.ok(getHandler, "GET handler should exist");
  assert.match(getHandler, /NextResponse\.redirect/);
  assert.match(getHandler, /confirmationUrl\.searchParams\.set\("token", token\)/);
  assert.doesNotMatch(getHandler, /createAdminClient|\.update\(/);
});
