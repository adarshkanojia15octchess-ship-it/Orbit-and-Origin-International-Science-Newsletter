# Subscriber and campaign operations

## Subscriber administration

The private Founder Workspace exposes a paginated subscriber table with email search and subscription-status filters, counts for active/pending/unsubscribed/bounced records, a CSV export, and per-record permanent deletion with a confirmation step.

The CSV contains email, first name, consent time and subscription timestamps only. Confirmation and unsubscribe tokens are never exported. Deleting a subscriber removes the email address, name and token hashes. Historical delivery rows are detached (subscriber_id becomes NULL) so campaign reporting remains available without retaining the address. Queued or in-flight deliveries for the deleted record are suppressed before deletion completes.

## Resend configuration

Add these server-only values to Vercel Production. Never commit them or paste them into chat:

- RESEND_API_KEY: a Resend API key with email-send permissions.
- EMAIL_FROM: a sender identity on a domain verified in Resend, for example ORBIT & ORIGIN <newsletter@your-verified-domain>.
- NEXT_PUBLIC_SITE_URL: https://orbit-and-origin-international-scie.vercel.app.
- UNSUBSCRIBE_SECRET: a long random secret used to derive subscriber-specific unsubscribe tokens.
- SUBSCRIPTION_RATE_LIMIT_SECRET: a separate long random secret used by the public subscription form's rate limiter.
- RESEND_WEBHOOK_SECRET: the signing secret returned when the Resend webhook endpoint is created.
- CAMPAIGN_WORKER_SECRET: a separate long random bearer secret shared with Supabase Vault.

Test sends require the API key, verified sender and public site URL. Real campaigns remain disabled until unsubscribe protection, the webhook secret and the worker secret are present. The public subscription form also requires SUBSCRIPTION_RATE_LIMIT_SECRET.

## Resend webhook

Create a Resend webhook pointing to:

https://orbit-and-origin-international-scie.vercel.app/api/webhooks/resend

Subscribe to the email lifecycle events used by the dashboard: sent, delivered, delivery delayed, bounced, complained and failed. Copy the webhook signing secret into Vercel as RESEND_WEBHOOK_SECRET.

The handler verifies the Svix signature against the raw request body before recording an event. The Svix event ID is unique in the database, so duplicate webhook deliveries do not apply an event twice. Bounce events mark an active or pending subscriber as bounced; complaint events unsubscribe the reader. Both transitions suppress their remaining queued campaign deliveries.

A webhook that arrives before the send response is committed is retained as pending and replayed after the provider message ID is stored. No raw webhook payload or recipient address is persisted in the event ledger.

## Durable worker schedule

The durable queue uses the existing email_deliveries table with attempts, due times and expiring leases. PostgreSQL uses FOR UPDATE SKIP LOCKED to avoid two workers claiming the same row. The worker handles up to three deliveries per invocation and checks active consent immediately before sending.

This project uses Supabase pg_cron and pg_net to call the protected Vercel worker every minute. This avoids relying on a frequent Vercel Cron schedule on the Hobby plan.

1. Add CAMPAIGN_WORKER_SECRET to Vercel Production. Create a separate random value; do not reuse CRON_SECRET.
2. In Supabase SQL Editor, store the exact same value in Vault:

   select vault.create_secret('PASTE_THE_SAME_WORKER_SECRET_HERE', 'campaign_worker_secret');

3. Run supabase/operations/schedule_campaign_delivery_worker.sql in the same Supabase project.
4. Confirm the Vercel deployment is Ready, then use the Founder Campaign Desk to send a test message before queueing a real campaign.

The cron job sends only the worker URL, a bearer token and a small JSON body. It does not expose the Resend key to PostgreSQL.

## Campaign workflow and delivery semantics

1. Create a draft linked to a published issue.
2. Send a test to one explicitly entered address. The test recipient is not added to the subscriber table; only a SHA-256 recipient fingerprint and test timestamp are recorded.
3. Review the test email, then explicitly confirm the subscriber campaign.
4. PostgreSQL inserts one unique delivery row per active subscriber. Campaign content becomes immutable once queued.
5. The worker sends using a deterministic idempotency key derived from campaign ID and delivery ID. Transient network errors, HTTP 429 and 5xx responses use bounded exponential retry (up to five attempts); permanent provider errors are marked failed.
6. Resend idempotency keys are valid for 24 hours. Automatic retries stay inside that window. Manual retry is limited to recent failed rows with no provider message ID; uncertain deliveries older than 24 hours must be reviewed rather than blindly resent.

This provides durable at-least-once queue processing with provider-side duplicate protection inside Resend's idempotency window. It does not claim exactly-once delivery across an external email provider.

## Operational safety

- Subscriber, campaign and delivery tables have no public RLS policies.
- All campaign actions and exports require the configured administrator session and use server-side service access.
- The worker has its own shared secret; the Resend API key and webhook secret remain server-only.
- Test sends are separate from subscriber campaigns. Real queueing requires a recorded test send and complete delivery configuration.
- Unsubscribe links support the reader-facing confirmation page and the RFC 8058 one-click POST header.
