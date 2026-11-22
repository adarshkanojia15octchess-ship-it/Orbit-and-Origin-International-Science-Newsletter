import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";
import { deleteSubscriber } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Subscriber Management | ORBIT & ORIGIN", robots: { index: false, follow: false } };

const statuses = ["active", "pending", "unsubscribed", "bounced"] as const;
type SubscriberStatus = typeof statuses[number];

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export default async function SubscriberManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; deleted?: string; error?: string }>;
}) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const params = await searchParams;
  const requestedStatus = String(params.status || "all");
  const status = (statuses as readonly string[]).includes(requestedStatus) ? requestedStatus as SubscriberStatus : "all";
  const search = String(params.q || "").trim().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page || "1", 10) || 1));
  const pageSize = 50;
  const admin = createAdminClient();

  const counts = await Promise.all([
    admin.from("subscribers").select("id", { count: "exact", head: true }),
    ...statuses.map((value) => admin.from("subscribers").select("id", { count: "exact", head: true }).eq("subscription_status", value)),
  ]);

  let query = admin.from("subscribers")
    .select("id,email,first_name,subscription_status,consent_at,subscribed_at,confirmed_at,unsubscribed_at", { count: "exact" })
    .order("subscribed_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (status !== "all") query = query.eq("subscription_status", status);
  if (search) query = query.ilike("email", "%" + search + "%");

  const { data: subscribers, error, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  const baseQuery = new URLSearchParams();
  if (search) baseQuery.set("q", search);
  if (status !== "all") baseQuery.set("status", status);
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(baseQuery);
    next.set("page", String(nextPage));
    return "/founder/subscribers?" + next.toString();
  };

  return (
    <main className="page-shell oo-ops-page">
      <header className="oo-ops-hero">
        <div>
          <span className="kicker">ORBIT &amp; ORIGIN / PRIVATE OPERATIONS</span>
          <h1>Subscriber desk.</h1>
          <p className="muted">A controlled view of reader consent, subscription status and data requests. Subscriber records are visible only to the authenticated administrator.</p>
        </div>
        <div className="oo-ops-hero-actions">
          <Link href="/founder/portal">Founder workspace ↗</Link>
          <Link href="/founder/campaigns">Campaign desk ↗</Link>
        </div>
      </header>

      {params.deleted && <p className="oo-ops-notice" role="status">Subscriber record deleted. Prior delivery outcomes remain anonymised for campaign reporting.</p>}
      {params.error && <p className="oo-ops-error" role="alert">{params.error === "delete" ? "The subscriber could not be deleted. Refresh and try again." : "The requested subscriber action was invalid."}</p>}
      {error && <p className="oo-ops-error" role="alert">Subscriber records could not be loaded. Check the database migration and administrator permissions.</p>}

      <section className="oo-ops-metrics" aria-label="Subscriber totals">
        <article><span>Total records</span><strong>{counts[0].count ?? "—"}</strong></article>
        {statuses.map((value, index) => <article key={value}><span>{value}</span><strong>{counts[index + 1].count ?? "—"}</strong></article>)}
      </section>

      <section className="oo-ops-section">
        <div className="oo-ops-section-head">
          <div>
            <span className="kicker">READER DATA</span>
            <h2>Subscriber records.</h2>
            <p className="muted">Export includes email, first name and consent/subscription timestamps only. Confirmation and unsubscribe tokens are never exported.</p>
          </div>
          <a className="oo-ops-primary-link" href="/api/founder/subscribers/export">Export CSV ↓</a>
        </div>

        <form className="oo-ops-filter" method="get">
          <label>Search email
            <input name="q" type="search" maxLength={120} defaultValue={search} placeholder="reader@example.com" />
          </label>
          <label>Subscription status
            <select name="status" defaultValue={status}>
              <option value="all">All records</option>
              {statuses.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <button type="submit">Apply filters</button>
          <Link href="/founder/subscribers">Clear</Link>
        </form>

        <div className="oo-ops-table-wrap">
          <table className="oo-ops-table">
            <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Consent</th><th>Confirmed</th><th>Unsubscribed</th><th>Data controls</th></tr></thead>
            <tbody>
              {(subscribers || []).map((subscriber) => (
                <tr key={subscriber.id}>
                  <td className="oo-ops-email">{subscriber.email}</td>
                  <td>{subscriber.first_name || "—"}</td>
                  <td><span className={"oo-ops-status oo-ops-status-" + subscriber.subscription_status}>{subscriber.subscription_status}</span></td>
                  <td>{dateLabel(subscriber.consent_at || subscriber.subscribed_at)}</td>
                  <td>{dateLabel(subscriber.confirmed_at)}</td>
                  <td>{dateLabel(subscriber.unsubscribed_at)}</td>
                  <td>
                    <details className="oo-ops-delete">
                      <summary>Delete</summary>
                      <div>
                        <p>Permanently remove this email address, name and consent tokens. Existing campaign delivery records are detached from the subscriber and retained without the address.</p>
                        <form action={deleteSubscriber}>
                          <input type="hidden" name="subscriber_id" value={subscriber.id} />
                          <button type="submit">Confirm permanent deletion</button>
                        </form>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {(!subscribers || subscribers.length === 0) && <tr><td colSpan={7} className="oo-ops-empty">{error ? "Subscriber records unavailable." : "No subscriber records match this view."}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="oo-ops-pagination">
          <span>Page {page} of {totalPages} · {count ?? 0} records</span>
          <div>{page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}{page < totalPages && <Link href={pageHref(page + 1)}>Next →</Link>}</div>
        </div>
      </section>
      <p className="oo-ops-privacy-note">Privacy safeguard: deletion removes the subscriber record and tokens. Delivery outcomes remain only in anonymised form; no email address is copied into campaign history.</p>
    </main>
  );
}
