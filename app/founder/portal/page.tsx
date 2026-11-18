import Link from "next/link";
import { getAdminContext } from "@/lib/auth/admin";
import { getPublisherOverview } from "@/lib/publisher/dashboard";
import { signOutAdmin } from "@/app/admin/login/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Founder Workspace | ORBIT & ORIGIN" };

const statusLabel: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function FounderWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [context, params] = await Promise.all([getAdminContext(), searchParams]);
  if (!context) {
    return (
      <main className="page-shell">
        <span className="kicker">ORBIT &amp; ORIGIN / FOUNDER ACCESS</span>
        <h1>Founder workspace.</h1>
        <p className="muted" style={{ maxWidth: 680 }}>The editorial workspace for managing editions, individual features and publication schedules.</p>
        {params.error === "oauth" && <p role="alert">Google sign-in could not be completed. Check the provider and callback configuration.</p>}
        {params.error === "unauthorised" && <p role="alert">This account is not authorised to manage the publication.</p>}
        <section className="story-card" style={{ maxWidth: 620, marginTop: 32 }}>
          <span className="kicker">AUTHORISED ACCESS ONLY</span>
          <h2>Sign in to continue.</h2>
          <p className="muted">Only the configured administrator account with the trusted administrator role can access editorial records.</p>
          <Link className="primary-link" href="/admin/login">Secure administrator sign-in ↗</Link>
        </section>
      </main>
    );
  }

  let overview;
  try {
    overview = await getPublisherOverview(context.supabase);
  } catch {
    return (
      <main className="page-shell">
        <span className="kicker">ORBIT &amp; ORIGIN / CONTROL ROOM</span>
        <h1>Founder workspace.</h1>
        <p className="muted">Signed in as {context.user.email}</p>
        <section className="story-card">
          <h2>Editorial data unavailable.</h2>
          <p className="muted">The dashboard could not read the issues and articles tables. Check Supabase migrations and administrator database policies.</p>
          <Link href="/admin">Open issue manager ↗</Link>
        </section>
      </main>
    );
  }

  const stats = [
    { label: "Issues", value: overview.totals.issues },
    { label: "Articles", value: overview.totals.articles },
    { label: "Scheduled items", value: overview.byStatus.scheduled.issues + overview.byStatus.scheduled.articles },
    { label: "Drafts", value: overview.byStatus.draft.issues + overview.byStatus.draft.articles },
  ];

  return (
    <main className="page-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <span className="kicker">ORBIT &amp; ORIGIN / FOUNDER CONTROL ROOM</span>
          <h1>Founder workspace.</h1>
          <p className="muted">Signed in as {context.user.email}</p>
        </div>
        <form action={signOutAdmin}><button type="submit">Sign out</button></form>
      </div>

      <section style={{ marginTop: 36 }}>
        <span className="kicker">PUBLICATION OVERVIEW</span>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 18 }}>
          {stats.map((stat) => (
            <article className="story-card" key={stat.label}>
              <p className="muted">{stat.label}</p>
              <p style={{ fontSize: "2.3rem", fontWeight: 700, margin: "8px 0" }}>{stat.value}</p>
              <p className="muted">Live database count</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <span className="kicker">QUICK ACTIONS</span>
        <div className="grid" style={{ marginTop: 18 }}>
          <article className="story-card"><h2>Create an edition</h2><p className="muted">Upload the issue PDF and cover, add publication details, then save a draft.</p><Link className="primary-link" href="/admin">Open issue manager ↗</Link></article>
          <article className="story-card"><h2>Write an article</h2><p className="muted">Create a distinct feature, select its department and associate it with its source issue.</p><Link className="primary-link" href="/admin/articles">Open Article Studio ↗</Link></article>
          <article className="story-card"><h2>Publication calendar</h2><p className="muted">Retrieve scheduled and published records from the protected calendar API.</p><Link className="primary-link" href="/admin">Manage publication schedules ↗</Link></article>
          <article className="story-card"><h2>Reader preview</h2><p className="muted">Check the public-facing issue archive and individual article library.</p><div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}><Link href="/issues">Issue archive ↗</Link><Link href="/articles">Articles ↗</Link></div></article>
          <article className="story-card"><h2>System health</h2><p className="muted">Check administrator access, Supabase connectivity, required environment configuration and deployment metadata.</p><Link className="primary-link" href="/publisher/health">Run operational checks ↗</Link></article>
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <span className="kicker">WORKFLOW SNAPSHOT</span>
        <h2>Content by status</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginTop: 18 }}>
          {Object.entries(overview.byStatus).map(([status, counts]) => (
            <article className="story-card" key={status}>
              <h3>{statusLabel[status]}</h3>
              <p className="muted">{counts.issues} issues · {counts.articles} articles</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <span className="kicker">RECENT EDITORIAL ACTIVITY</span>
        <div className="grid" style={{ marginTop: 18 }}>
          <article className="story-card">
            <h2>Recently updated issues</h2>
            {overview.recentIssues.length ? overview.recentIssues.map((issue) => (
              <div key={issue.id} style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}>
                <p className="kicker">ISSUE {String(issue.issue_number).padStart(3, "0")} · {statusLabel[issue.status] ?? issue.status}</p>
                <h3>{issue.title}</h3>
                <p className="muted">Updated {dateLabel(issue.updated_at)}</p>
              </div>
            )) : <p className="muted">No issue records yet.</p>}
            <Link href="/admin">Manage all issues ↗</Link>
          </article>
          <article className="story-card">
            <h2>Recently updated articles</h2>
            {overview.recentArticles.length ? overview.recentArticles.map((article) => (
              <div key={article.id} style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}>
                <p className="kicker">{article.department.replaceAll("-", " ")} · {statusLabel[article.status] ?? article.status}</p>
                <h3>{article.headline}</h3>
                <p className="muted">By {article.author} · Updated {dateLabel(article.updated_at)}</p>
              </div>
            )) : <p className="muted">No article records yet.</p>}
            <Link href="/admin/articles">Manage all articles ↗</Link>
          </article>
        </div>
      </section>

      <section className="story-card" style={{ marginTop: 48 }}>
        <span className="kicker">EDITORIAL STANDARD</span>
        <h2>One edition. Multiple independently readable stories.</h2>
        <p className="muted">Upload the complete issue PDF, then create a separate article record for every feature you want readers to discover in the Articles section. Associate each article with its source issue. PDF upload does not automatically extract or publish article pages.</p>
        <p className="muted">Dashboard refreshed {dateLabel(overview.generatedAt)}.</p>
      </section>
    </main>
  );
}
