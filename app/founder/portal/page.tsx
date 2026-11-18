import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Issue } from "@/lib/types";
import { getAdminContext } from "@/lib/auth/admin";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";
import {
  cancelIssueSchedule, createIssue, publishIssue, scheduleIssue, unpublishIssue, updateIssue,
} from "@/app/admin/actions";
import { signOutAdmin } from "@/app/admin/login/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Private Founder Workspace | ORBIT & ORIGIN",
  robots: { index: false, follow: false },
};

const departmentLabels: Record<string, string> = {
  "tapestry-of-worlds": "Tapestry of Worlds",
  "frontier-tech": "Frontier Tech",
  "universal-record": "The Universal Record",
};
const statusLabels: Record<string, string> = {
  draft: "Draft", scheduled: "Scheduled", published: "Published", archived: "Archived",
};
const feedback: Record<string, string> = {
  details: "Check the issue number, title, description, publication date and selected departments.",
  pdf: "Choose a valid PDF file no larger than 25 MB.",
  cover: "Choose a JPEG, PNG or WebP cover image no larger than 8 MB.",
  upload: "The upload failed. Check the Supabase issue-drafts bucket and administrator storage permissions.",
  duplicate: "That issue number or issue slug is already in use.",
  save: "The issue details could not be saved. Check the database connection and issue policies.",
  issue: "The selected issue could not be found.",
  "publish-assets": "The issue files could not be copied to public storage. Check the issue-public bucket and storage policies.",
  "publish-conflict": "Another publication operation is already acting on this issue. Refresh and try again.",
  publish: "The issue could not be published. Its draft should remain available for review.",
  schedule: "Choose a valid future date and time.",
  unpublish: "The issue could not be returned to draft.",
  "unpublish-assets": "The public issue files could not be restored to private draft storage.",
  "unpublish-conflict": "The issue changed during this operation. Refresh and try again.",
  "unpublish-cleanup": "The issue was unpublished, but a storage cleanup step needs administrator attention.",
};

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
function dateTimeLabel(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
function safeDraftPath(value: string | null, issueNumber: number) {
  if (!value || value.startsWith("http")) return null;
  if (!value.startsWith(`issues/${issueNumber}/`) || value.includes("..") || value.includes("\\\\")) return null;
  return value;
}

async function issuePreviewLinks(supabase: SupabaseClient, issue: Issue) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (issue.status === "published") {
    return {
      pdfUrl: issue.pdf_url && isPublishedStorageAsset(issue.pdf_url, projectUrl) ? issue.pdf_url : null,
      coverUrl: issue.cover_image_url && isPublishedStorageAsset(issue.cover_image_url, projectUrl) ? issue.cover_image_url : null,
    };
  }
  const pdfPath = safeDraftPath(issue.pdf_url, issue.issue_number);
  const coverPath = safeDraftPath(issue.cover_image_url, issue.issue_number);
  const [pdf, cover] = await Promise.all([
    pdfPath ? supabase.storage.from("issue-drafts").createSignedUrl(pdfPath, 20 * 60) : Promise.resolve({ data: null }),
    coverPath ? supabase.storage.from("issue-drafts").createSignedUrl(coverPath, 20 * 60) : Promise.resolve({ data: null }),
  ]);
  return { pdfUrl: pdf.data?.signedUrl ?? null, coverUrl: cover.data?.signedUrl ?? null };
}

export default async function FounderWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; published?: string; updated?: string; scheduled?: string; unscheduled?: string; unpublished?: string }>;
}) {
  let context: Awaited<ReturnType<typeof getAdminContext>>;
  try {
    context = await getAdminContext();
  } catch {
    redirect("/admin/login?error=configuration");
  }
  if (!context) redirect("/admin/login");

  const params = await searchParams;
  const { data, error } = await context.supabase.from("issues").select("*").order("issue_number", { ascending: false });
  const issues = (data || []) as Issue[];
  const previews = await Promise.all(issues.map(async (issue) => ({ issue, ...(await issuePreviewLinks(context.supabase, issue)) })));

  return (
    <main className="page-shell oo-founder-console">
      <header className="oo-founder-console-hero">
        <div>
          <span className="kicker">ORBIT &amp; ORIGIN / PRIVATE EDITORIAL DESK</span>
          <h1>Founder workspace.</h1>
          <p className="muted">A private control room for editions, publication details and editorial releases.</p>
          <p className="oo-founder-session">Authenticated administrator · {context.user.email}</p>
        </div>
        <div className="oo-founder-hero-actions">
          <Link className="oo-founder-quiet-link" href="/issues" target="_blank">View public archive ↗</Link>
          <form action={signOutAdmin}><button type="submit">Sign out</button></form>
        </div>
      </header>

      {(params.created || params.published || params.updated || params.scheduled || params.unscheduled || params.unpublished) && (
        <p className="oo-founder-notice" role="status">
          {params.created ? "The edition has been saved as a draft." :
           params.published ? "The edition has been published to the public archive." :
           params.updated ? "Edition details have been updated." :
           params.scheduled ? "The edition has been scheduled." :
           params.unscheduled ? "The schedule has been cancelled." : "The edition has been returned to draft."}
        </p>
      )}
      {params.error && <p className="oo-founder-error" role="alert">{feedback[params.error] || "The requested publishing action could not be completed."}</p>}
      {error && <p className="oo-founder-error" role="alert">The issue database could not be read. Check the Supabase connection, migrations and administrator database policy. The upload form remains available, but the issue list may be incomplete.</p>}

      <section className="oo-founder-section" aria-labelledby="upload-heading">
        <div className="oo-founder-section-heading">
          <div><span className="kicker">01 / New edition</span><h2 id="upload-heading">Upload an issue.</h2></div>
          <p>Enter its bibliographic details, add the edition PDF and cover, then save it privately as a draft. Nothing becomes public until you publish it.</p>
        </div>
        <div className="oo-founder-upload-layout">
          <form className="oo-founder-upload-form" action={createIssue} encType="multipart/form-data">
            <input type="hidden" name="return_to" value="/founder/portal"/>
            <div className="oo-founder-form-grid">
              <label className="form-field">Issue number<input name="issue_number" type="number" min="1" max="999999" defaultValue="3" required/></label>
              <label className="form-field">Publication date<input name="publication_date" type="date" defaultValue="2026-11-21" required/></label>
            </div>
            <label className="form-field">Edition title<input name="title" type="text" minLength={3} maxLength={160} defaultValue="The Mapped Cosmos" required/></label>
            <label className="form-field">Public description<textarea name="description" rows={4} minLength={10} maxLength={2000} defaultValue="Euclid opens a new window onto the invisible Universe. This edition explores Euclid's DR1-Foundation release, the cosmic web and gravitational-lensing candidates, alongside FLIP exoplanet imaging, ISRO's NVS-03 and NASA's ESCAPADE mission." required/></label>
            <fieldset className="oo-founder-departments">
              <legend>Departments represented</legend>
              {Object.entries(departmentLabels).map(([value, label]) => <label key={value}><input type="checkbox" name="departments" value={value} defaultChecked/> {label}</label>)}
            </fieldset>
            <label className="form-field">Complete issue PDF <span className="oo-founder-field-hint">PDF · maximum 25 MB</span><input type="file" name="pdf" accept="application/pdf,.pdf" required/></label>
            <label className="form-field">Cover image <span className="oo-founder-field-hint">JPEG, PNG or WebP · maximum 8 MB</span><input type="file" name="cover" accept="image/jpeg,image/png,image/webp" required/></label>
            <div className="oo-founder-form-actions"><button type="submit">Upload and save as draft ↗</button><span>Drafts remain private until you publish.</span></div>
          </form>
          <aside className="oo-founder-upload-note">
            <span className="kicker">READY FOR ISSUE 003</span>
            <strong>The Mapped Cosmos</strong>
            <p>The details are prefilled from the attached 10-page Issue 003 edition. Confirm them, select the PDF from your device and add its cover artwork.</p>
            <dl>
              <div><dt>Release date</dt><dd>21 November 2026</dd></div>
              <div><dt>Departments</dt><dd>All three editorial departments</dd></div>
              <div><dt>Upload state</dt><dd>Private draft until you publish</dd></div>
            </dl>
            <Link href="/issues" target="_blank">See the public archive ↗</Link>
          </aside>
        </div>
      </section>

      <section className="oo-founder-section" aria-labelledby="editions-heading">
        <div className="oo-founder-section-heading">
          <div><span className="kicker">02 / Publication library</span><h2 id="editions-heading">Your editions.</h2></div>
          <p>Every saved issue appears here with its metadata, cover preview, file access and publication controls.</p>
        </div>
        {!error && issues.length === 0 ? (
          <div className="oo-founder-empty"><span className="kicker">NO DATABASE RECORDS</span><h3>Your first issue record will appear here.</h3><p>Use the upload form above to create a draft. PDFs in the code repository are not automatically imported into the publication database.</p></div>
        ) : (
          <div className="oo-founder-issue-list">
            {previews.map(({ issue, pdfUrl, coverUrl }) => (
              <article className="oo-founder-issue-card" key={issue.id}>
                <div className="oo-founder-issue-cover">
                  {coverUrl ? <div className="oo-founder-cover-image" role="img" aria-label={`Cover artwork for Issue ${issue.issue_number}: ${issue.title}`} style={{ backgroundImage: `url("${coverUrl.replaceAll('"', "%22")}")` }}/> : <div className="oo-founder-cover-placeholder"><span>ORBIT &amp; ORIGIN</span><strong>{String(issue.issue_number).padStart(3, "0")}</strong></div>}
                </div>
                <div className="oo-founder-issue-content">
                  <div className="oo-founder-issue-topline"><span className="kicker">ISSUE {String(issue.issue_number).padStart(3, "0")}</span><span className={`oo-founder-status oo-founder-status-${issue.status}`}>{statusLabels[issue.status] || issue.status}</span></div>
                  <h3>{issue.title}</h3><p>{issue.description}</p>
                  <dl className="oo-founder-issue-meta">
                    <div><dt>Publication date</dt><dd>{dateLabel(issue.publication_date)}</dd></div>
                    <div><dt>Scheduled for</dt><dd>{dateTimeLabel(issue.scheduled_at || null)}</dd></div>
                    <div><dt>Departments</dt><dd>{issue.departments?.map((department) => departmentLabels[department] || department).join(" · ") || "Not specified"}</dd></div>
                  </dl>
                  <div className="oo-founder-asset-links">
                    {pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer">Open PDF ↗</a> : <span>PDF preview unavailable</span>}
                    {issue.status === "published" && <Link href={`/issues/${issue.issue_number}`} target="_blank">Open public edition ↗</Link>}
                  </div>
                  <details className="oo-founder-edit-details">
                    <summary>Edit edition details</summary>
                    <form action={updateIssue}>
                      <input type="hidden" name="return_to" value="/founder/portal"/><input type="hidden" name="issue_id" value={issue.id}/>
                      <label className="form-field">Title<input name="title" defaultValue={issue.title} minLength={3} maxLength={160} required/></label>
                      <label className="form-field">Description<textarea name="description" defaultValue={issue.description} minLength={10} maxLength={2000} rows={3} required/></label>
                      <label className="form-field">Publication date<input type="date" name="publication_date" defaultValue={issue.publication_date} required/></label>
                      <button type="submit">Save changes</button>
                    </form>
                  </details>
                  {(issue.status === "draft" || issue.status === "scheduled") && (
                    <div className="oo-founder-issue-actions">
                      <form action={publishIssue}><input type="hidden" name="return_to" value="/founder/portal"/><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Publish now</button></form>
                      {issue.status === "draft" && <form action={scheduleIssue} className="oo-founder-schedule-form"><input type="hidden" name="return_to" value="/founder/portal"/><input type="hidden" name="issue_id" value={issue.id}/><label className="sr-only" htmlFor={`schedule-${issue.id}`}>Schedule publication time (IST)</label><input id={`schedule-${issue.id}`} type="datetime-local" name="scheduled_at" required/><button type="submit">Schedule</button></form>}
                      {issue.status === "scheduled" && <form action={cancelIssueSchedule}><input type="hidden" name="return_to" value="/founder/portal"/><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Cancel schedule</button></form>}
                    </div>
                  )}
                  {issue.status === "published" && <form className="oo-founder-unpublish" action={unpublishIssue}><input type="hidden" name="return_to" value="/founder/portal"/><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Return to draft</button></form>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="oo-founder-bottom-grid">
        <article><span className="kicker">03 / Articles</span><h2>Publish individual features.</h2><p>Create a separate article record for every feature readers should discover independently, and associate it with the edition it came from.</p><Link href="/admin/articles">Open Article Studio ↗</Link></article>
        <article><span className="kicker">04 / Operations</span><h2>Check the platform.</h2><p>Review database connectivity, administrator access and deployment configuration.</p><Link href="/publisher/health">Open system diagnostics ↗</Link></article>
      </section>
    </main>
  );
}
