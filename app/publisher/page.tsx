import Link from "next/link";
import { getAdminContext } from "@/lib/auth/admin";

export const metadata = { title: "Publisher Portal" };

const workspaces = [
  { title: "Issue publishing", description: "Upload an edition PDF and cover, review its details, then publish or schedule it in the public archive.", href: "/admin", action: "Manage editions" },
  { title: "Article studio", description: "Create individual stories, select their department, connect them to an issue, add sources and images, then publish or schedule.", href: "/admin/articles", action: "Write and publish articles" },
  { title: "Public issue archive", description: "Check what readers can currently see in the published archive.", href: "/issues", action: "View the archive" },
  { title: "Public articles", description: "Review the reader-facing article library and published stories.", href: "/articles", action: "View articles" },
];

export default async function PublisherPortalPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [context, params] = await Promise.all([getAdminContext(), searchParams]);
  return (
    <main className="page-shell">
      <span className="kicker">ORBIT &amp; ORIGIN / CONTROL ROOM</span>
      <h1>Publisher portal.</h1>
      <p className="muted" style={{ maxWidth: 720 }}>One secure starting point for managing editions and the individual reporting inside them. Drafts stay private until you choose to publish.</p>
      {params.error === "oauth" && <p role="alert" className="muted">Google sign-in could not be completed. Check the Google provider and callback configuration, then try again.</p>}
      {params.error === "unauthorised" && <p role="alert" className="muted">That Google account is not authorised as the publication administrator.</p>}
      {context ? (
        <section style={{ marginTop: 32 }}>
          <p role="status">Signed in as {context.user.email}</p>
          <div className="grid" style={{ marginTop: 24 }}>
            {workspaces.map((item) => <article className="story-card" key={item.href}>
              <span className="kicker">PUBLISHING WORKSPACE</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <Link className="primary-link" href={item.href}>{item.action} ↗</Link>
            </article>)}
          </div>
        </section>
      ) : (
        <section className="story-card" style={{ maxWidth: 620, marginTop: 32 }}>
          <span className="kicker">AUTHORISED ACCESS ONLY</span>
          <h2>Sign in to continue.</h2>
          <p className="muted">Use the administrator account registered for ORBIT &amp; ORIGIN. Google sign-in is accepted only when the account has the trusted administrator role and matches the configured administrator email.</p>
          <Link className="primary-link" href="/admin/login">Open secure sign-in ↗</Link>
        </section>
      )}
      <p className="muted" style={{ marginTop: 36 }}>Editorial rule: create one article record per distinct story, associate it with its source edition, and preserve the original reporting. Publishing an issue PDF does not automatically publish its individual articles.</p>
    </main>
  );
}
