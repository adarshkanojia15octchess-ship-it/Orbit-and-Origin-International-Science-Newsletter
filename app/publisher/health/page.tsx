import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "System health | Publisher Portal" };

function Check({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="story-card" style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
      <div>
        <h3>{label}</h3>
        <p className="muted">{detail}</p>
      </div>
      <span aria-label={ok ? "Passed" : "Needs attention"} style={{ whiteSpace: "nowrap", fontWeight: 700, color: ok ? "#21865b" : "#b45309" }}>
        {ok ? "PASS" : "CHECK"}
      </span>
    </div>
  );
}

export default async function PublisherHealthPage() {
  const context = await getAdminContext();
  if (!context) redirect("/issues");

  const [issues, articles] = await Promise.all([
    context.supabase.from("issues").select("id", { count: "exact", head: true }),
    context.supabase.from("articles").select("id", { count: "exact", head: true }),
  ]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let siteHost = "Not configured";
  if (siteUrl) {
    try { siteHost = new URL(siteUrl).host; } catch { siteHost = "Invalid URL"; }
  }

  const checks = [
    { label: "Administrator session", ok: true, detail: "The signed-in account passed the trusted administrator role and email checks." },
    { label: "Supabase URL", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), detail: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configured (value hidden)." : "Missing NEXT_PUBLIC_SUPABASE_URL." },
    { label: "Supabase public key", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), detail: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Configured (value hidden)." : "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY." },
    { label: "Administrator allow-list", ok: Boolean(process.env.ADMIN_EMAIL), detail: process.env.ADMIN_EMAIL ? "ADMIN_EMAIL is configured (address hidden)." : "Missing ADMIN_EMAIL." },
    { label: "Canonical site URL", ok: Boolean(siteUrl) && siteHost !== "Invalid URL", detail: siteHost },
    { label: "Issues database", ok: !issues.error, detail: issues.error ? "Query failed; inspect Supabase table access and schema." : `${issues.count ?? 0} issue records reachable.` },
    { label: "Articles database", ok: !articles.error, detail: articles.error ? "Query failed; inspect Supabase table access and schema." : `${articles.count ?? 0} article records reachable.` },
  ];
  const allOk = checks.every((check) => check.ok);

  return (
    <main className="page-shell">
      <span className="kicker">ORBIT &amp; ORIGIN / PUBLISHER OPERATIONS</span>
      <h1>System health.</h1>
      <p className="muted">A private operational check of the current application runtime and editorial database. Secret values are never displayed.</p>
      <section className="story-card" style={{ marginTop: 24 }}>
        <p className="kicker">OVERALL STATUS</p>
        <h2>{allOk ? "Core checks passed." : "Some configuration needs attention."}</h2>
        <p className="muted">Checked {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date())} · Environment: {process.env.VERCEL_ENV ?? "local/unknown"} · Commit: {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "not supplied by host"}</p>
      </section>
      <div className="grid" style={{ marginTop: 18 }}>
        {checks.map((check) => <Check key={check.label} {...check} />)}
      </div>
      <section className="story-card" style={{ marginTop: 24 }}>
        <h2>Protected endpoint check</h2>
        <p className="muted">The JSON diagnostics endpoint performs the same administrator check and returns machine-readable status for support and deployment verification.</p>
        <Link className="primary-link" href="/api/publisher/health">Open private health API ↗</Link>
      </section>
      <p style={{ marginTop: 28 }}><Link href="/founder/portal">← Back to Founder Workspace</Link></p>
    </main>
  );
}
