import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCampaign, queueCampaign, retryFailedCampaignDeliveries, sendCampaignTest } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Campaign Delivery | ORBIT & ORIGIN", robots: { index: false, follow: false } };

const errorMessages: Record<string, string> = {
  invalid: "Check the campaign fields and try again.",
  issue: "The linked issue must still be published.",
  create: "The campaign draft could not be saved.",
  "test-email": "Enter a valid test-recipient email address.",
  "resend-config": "Add RESEND_API_KEY, EMAIL_FROM and NEXT_PUBLIC_SITE_URL before sending a test.",
  "campaign-state": "That campaign is no longer an editable draft.",
  "test-send": "Resend rejected the test send. Check the sender domain, API key and request logs.",
  "test-log": "The test message was sent, but its success could not be recorded. Refresh before queueing the campaign.",
  "queue-config": "Campaign delivery is disabled until Resend, unsubscribe, webhook and worker secrets are configured.",
  queue: "The delivery queue could not be created.",
  "empty-list": "There are no active, confirmed subscribers to receive this campaign.",
  "test-required": "Send and record a test message before queuing a subscriber campaign.",
  retry: "Failed deliveries could not be re-queued.",
  "retry-window": "Automatic idempotency protection is limited to 24 hours. Review older uncertain deliveries instead of blindly resending.",
};

function dateTimeLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export default async function CampaignDeliveryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const params = await searchParams;
  const admin = createAdminClient();

  const [issuesResult, campaignsResult, statsResult, subscriberCount] = await Promise.all([
    admin.from("issues").select("id,issue_number,title,description,publication_date,status").order("publication_date", { ascending: false }),
    admin.from("campaigns").select("id,issue_id,subject,preheader,message_text,status,queued_at,completed_at,test_sent_at,last_error,created_at").order("created_at", { ascending: false }).limit(50),
    admin.rpc("campaign_delivery_stats"),
    admin.from("subscribers").select("id", { count: "exact", head: true }).eq("subscription_status", "active"),
  ]);

  const allIssues = issuesResult.data || [];
  const publishedIssues = allIssues.filter((issue) => issue.status === "published");
  const campaigns = campaignsResult.data || [];
  const issueById = new Map(allIssues.map((issue) => [issue.id, issue]));
  const metrics = new Map<string, Record<string, number>>();
  for (const row of (statsResult.data || []) as Array<{ campaign_id: string; delivery_status: string; total: number }>) {
    const current = metrics.get(row.campaign_id) || {};
    current[row.delivery_status] = Number(row.total);
    metrics.set(row.campaign_id, current);
  }

  const requiredConfig = ["RESEND_API_KEY", "EMAIL_FROM", "NEXT_PUBLIC_SITE_URL", "UNSUBSCRIBE_SECRET", "RESEND_WEBHOOK_SECRET", "CAMPAIGN_WORKER_SECRET"];
  const missingConfig = requiredConfig.filter((key) => !process.env[key]);
  const workerReady = missingConfig.length === 0;
  const signupReady = Boolean(process.env.SUBSCRIPTION_RATE_LIMIT_SECRET && process.env.UNSUBSCRIBE_SECRET);
  const activeSubscribers = subscriberCount.count ?? 0;

  return (
    <main className="page-shell oo-ops-page">
      <header className="oo-ops-hero">
        <div>
          <span className="kicker">ORBIT &amp; ORIGIN / PRIVATE OPERATIONS</span>
          <h1>Campaign desk.</h1>
          <p className="muted">Prepare an issue announcement, send a one-recipient proof, then deliberately queue the confirmed campaign for active subscribers.</p>
        </div>
        <div className="oo-ops-hero-actions">
          <Link href="/founder/portal">Founder workspace ↗</Link>
          <Link href="/founder/subscribers">Subscriber desk ↗</Link>
        </div>
      </header>

      {params.created && <p className="oo-ops-notice" role="status">Campaign draft created. Send a test message before queueing it for readers.</p>}
      {params.tested && <p className="oo-ops-notice" role="status">Test message accepted by Resend. It was sent only to the test address.</p>}
      {params.queued && <p className="oo-ops-notice" role="status">Campaign queued for {params.queued} active subscribers. Delivery will be processed in small background batches.</p>}
      {params.retried && <p className="oo-ops-notice" role="status">Eligible failed deliveries have been returned to the queue using their original idempotency keys.</p>}
      {params.error && <p className="oo-ops-error" role="alert">{errorMessages[params.error] || "The requested campaign operation could not be completed."}</p>}
      {(issuesResult.error || campaignsResult.error || statsResult.error || subscriberCount.error) && <p className="oo-ops-error" role="alert">Campaign data could not be read. Apply the newsletter campaign migration and verify administrator database access.</p>}

      <section className="oo-ops-config">
        <div>
          <span className="kicker">DELIVERY READINESS</span>
          <h2>{workerReady ? "Resend configuration present." : "Campaign delivery is not yet enabled."}</h2>
          <p>Test sends require the Resend API key and verified sender. Subscriber campaigns additionally require unsubscribe protection, a verified webhook and the protected background worker.</p>
          {!signupReady && <p className="oo-ops-config-warning">Public subscription intake also needs SUBSCRIPTION_RATE_LIMIT_SECRET and UNSUBSCRIBE_SECRET.</p>}
        </div>
        <div className="oo-ops-config-state">
          <span className={workerReady ? "oo-ops-status oo-ops-status-active" : "oo-ops-status oo-ops-status-pending"}>{workerReady ? "CONFIGURED" : "SETUP REQUIRED"}</span>
          {missingConfig.length > 0 && <small>Missing: {missingConfig.join(", ")}</small>}
        </div>
      </section>

      <section className="oo-ops-section" aria-labelledby="campaign-create-title">
        <div className="oo-ops-section-head">
          <div><span className="kicker">01 / NEW ISSUE CAMPAIGN</span><h2 id="campaign-create-title">Prepare a dispatch.</h2></div>
          <p className="muted">Campaigns are tied to a published issue. Drafting and test sends never add the test recipient to the subscriber list.</p>
        </div>
        {publishedIssues.length === 0 ? (
          <div className="oo-ops-empty-state">Publish an issue before preparing a campaign. The email will link directly to that public edition.</div>
        ) : (
          <form className="oo-campaign-form" action={createCampaign}>
            <label>Published issue
              <select name="issue_id" required defaultValue="">
                <option value="" disabled>Select a published issue</option>
                {publishedIssues.map((issue) => <option value={issue.id} key={issue.id}>Issue {String(issue.issue_number).padStart(3, "0")} — {issue.title}</option>)}
              </select>
            </label>
            <label>Email subject
              <input name="subject" type="text" minLength={3} maxLength={160} required placeholder="A new window on the Universe" />
            </label>
            <label>Inbox preview text
              <input name="preheader" type="text" maxLength={180} placeholder="A short line shown beside the subject in many inboxes" />
            </label>
            <label>Editorial message
              <textarea name="message_text" minLength={10} maxLength={8000} rows={6} required placeholder="Write the note readers will receive. Use a blank line to start a new paragraph." />
            </label>
            <p className="muted">The issue title, description and public reading link are added automatically. This field is plain text; HTML is escaped in the email template.</p>
            <button type="submit">Save campaign draft</button>
          </form>
        )}
      </section>

      <section className="oo-ops-section" aria-labelledby="campaign-list-title">
        <div className="oo-ops-section-head">
          <div><span className="kicker">02 / DELIVERY MONITOR</span><h2 id="campaign-list-title">Campaign history.</h2></div>
          <p className="muted">{activeSubscribers} active confirmed subscribers are currently eligible for a new campaign.</p>
        </div>
        {campaigns.length === 0 ? <div className="oo-ops-empty-state">No campaign drafts or delivery runs yet.</div> : (
          <div className="oo-campaign-list">
            {campaigns.map((campaign) => {
              const issue = issueById.get(campaign.issue_id);
              const stats = metrics.get(campaign.id) || {};
              const values = [
                ["Queued", stats.queued || 0], ["Sending", stats.sending || 0],
                ["Accepted", stats.sent || 0], ["Delivered", stats.delivered || 0],
                ["Bounced", stats.bounced || 0], ["Complaints", stats.complained || 0],
                ["Failed", stats.failed || 0], ["Suppressed", stats.suppressed || 0],
              ];
              return (
                <article className="oo-campaign-card" key={campaign.id}>
                  <div className="oo-campaign-card-top">
                    <div>
                      <span className="kicker">ISSUE {issue ? String(issue.issue_number).padStart(3, "0") : "—"}</span>
                      <h3>{campaign.subject}</h3>
                      <p className="muted">{issue?.title || "Linked issue unavailable"}</p>
                    </div>
                    <span className={"oo-ops-status oo-ops-status-" + campaign.status}>{campaign.status}</span>
                  </div>
                  <div className="oo-campaign-metrics">{values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
                  <p className="oo-campaign-meta">Created {dateTimeLabel(campaign.created_at)} · Queued {dateTimeLabel(campaign.queued_at)} · Completed {dateTimeLabel(campaign.completed_at)}</p>
                  {campaign.test_sent_at && <p className="oo-campaign-test-state">Test send accepted {dateTimeLabel(campaign.test_sent_at)}. Only a recipient hash is stored.</p>}
                  {campaign.last_error && <p className="oo-ops-error" role="status">{campaign.last_error}</p>}

                  {campaign.status === "draft" && (
                    <div className="oo-campaign-actions">
                      <form action={sendCampaignTest}>
                        <input type="hidden" name="campaign_id" value={campaign.id} />
                        <label>Send a test to
                          <input name="test_email" type="email" autoComplete="email" required maxLength={254} placeholder="your-test-inbox@example.com" />
                        </label>
                        <button type="submit">Send test only</button>
                      </form>
                      {campaign.test_sent_at && (
                        <details>
                          <summary>Queue this campaign for {activeSubscribers} active subscribers</summary>
                          <p>This is the real subscriber campaign. Each active reader gets one delivery row and a stable Resend idempotency key. Unsubscribed or bounced addresses are suppressed before dispatch.</p>
                          <form action={queueCampaign}>
                            <input type="hidden" name="campaign_id" value={campaign.id} />
                            <button type="submit" disabled={!workerReady || activeSubscribers === 0}>Confirm and queue campaign</button>
                          </form>
                        </details>
                      )}
                    </div>
                  )}
                  {Number(stats.failed || 0) > 0 && (
                    <form className="oo-campaign-retry" action={retryFailedCampaignDeliveries}>
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <button type="submit" disabled={!workerReady}>Retry eligible failures (24-hour idempotency window)</button>
                    </form>
                  )}
                  {campaign.status !== "draft" && <p className="muted">Campaign content is immutable after it enters the delivery queue.</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="oo-ops-privacy-note">Queue design: each recipient has one durable delivery row, an atomic lease and a deterministic delivery ID. The worker re-checks active consent immediately before sending; hard bounces and complaints suppress queued sends.</p>
      <p className="oo-ops-privacy-note">Automatic retries are bounded to five attempts. The same Resend idempotency key is reused across retries; manual retries are limited to the 24-hour provider deduplication window.</p>
      <p><a className="oo-ops-back-link" href="https://github.com/adarshkanojia15octchess-ship-it/Orbit-and-Origin-International-Science-Newsletter/blob/main/docs/newsletter-operations.md" target="_blank" rel="noopener noreferrer">Read the Resend and worker setup guide ↗</a></p>
    </main>
  );
}
