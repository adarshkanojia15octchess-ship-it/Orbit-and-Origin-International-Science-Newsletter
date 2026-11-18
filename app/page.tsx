import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";
import ReaderRoadmap from "@/components/reader-roadmap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "ORBIT & ORIGIN — Exploring the Universe",
  description: "An independent science and astronomy publication. Open to curiosity. Committed to evidence.",
};

function formatPublicationDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function Home() {
  let latestIssue: Issue | null = null;
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("issues")
      .select("*")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .order("issue_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    latestIssue = data as Issue | null;
  } catch {
    // Keep the rest of the homepage available if the publication database is unavailable.
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const cover = latestIssue?.cover_image_url && isPublishedStorageAsset(latestIssue.cover_image_url, projectUrl)
    ? latestIssue.cover_image_url
    : null;
  const issueLabel = latestIssue ? String(latestIssue.issue_number).padStart(3, "0") : null;

  return (
    <>
      <section className="hero">
        <span className="kicker">An independent science &amp; astronomy publication</span>
        <h1>Exploring the Universe.<br /><em>Understanding Our Place.</em></h1>
        <p>Read thoughtful science editions, explore the stories behind them, and follow the discoveries reshaping how we understand our place in the Universe.</p>
        <div className="hero-actions">
          <Link className="primary-link" href="/latest">Read the latest issue ↗</Link>
          <Link className="secondary-link" href="/issues">Browse the archive</Link>
        </div>
      </section>

      <section className="lead-issue" aria-labelledby="lead-issue-title">
        <div className="lead-issue-copy">
          <span className="kicker">{latestIssue ? `The latest edition · Issue ${issueLabel}` : "The ORBIT & ORIGIN library"}</span>
          {latestIssue ? (
            <>
              <p className="lead-issue-date">{formatPublicationDate(latestIssue.publication_date)}</p>
              <h2 id="lead-issue-title">{latestIssue.title}</h2>
              <p className="lead-issue-deck">{latestIssue.description}</p>
              <Link className="primary-link" href="/latest">Discover Issue {issueLabel} ↗</Link>
              <p className="lead-issue-inaugural">Explore every published edition in the <Link href="/issues">ORBIT &amp; ORIGIN archive ↗</Link>.</p>
            </>
          ) : (
            <div className="lead-issue-status" role="status">
              <span>Our editorial library</span>
              <strong>The next discovery starts here.</strong>
              <Link href="/issues">Browse the issue archive ↗</Link>
            </div>
          )}
        </div>
        <div
          className={"lead-issue-art" + (cover ? " has-cover" : "")}
          style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(10,25,43,.12),rgba(10,25,43,.02)),url(" + JSON.stringify(cover) + ")" } : undefined}
          role="img"
          aria-label={cover
            ? `Cover artwork for ORBIT & ORIGIN Issue ${issueLabel}, ${latestIssue?.title}`
            : latestIssue
              ? `Typographic editorial artwork for Issue ${issueLabel}, ${latestIssue.title}`
              : "ORBIT & ORIGIN editorial artwork"}
        >
          {!cover && latestIssue && (
            <>
              <span className="lead-art-masthead">ORBIT <i>&amp;</i> ORIGIN</span>
              <span className="lead-art-number">ISSUE {issueLabel}</span>
              <strong>{latestIssue.title}</strong>
              <span className="lead-art-foot">OPEN TO CURIOSITY · COMMITTED TO EVIDENCE</span>
            </>
          )}
          {!cover && !latestIssue && (
            <>
              <span className="lead-art-masthead">ORBIT <i>&amp;</i> ORIGIN</span>
              <strong>THE<br />UNIVERSE<br /><em>AWAITS</em></strong>
              <span className="lead-art-foot">OPEN TO CURIOSITY · COMMITTED TO EVIDENCE</span>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div><span className="kicker">The publication</span><h2>Three windows into discovery.</h2></div>
          <p className="muted">Science, carefully observed and beautifully told.</p>
        </div>
        <div className="grid">
          <article className="story-card"><span className="kicker">01 / Cosmos</span><h3>Tapestry of Worlds</h3><p>Astronomy, astrophysics, cosmology, planetary science and space exploration.</p></article>
          <article className="story-card"><span className="kicker">02 / Innovation</span><h3>Frontier Tech</h3><p>Engineering, scientific instruments, emerging technologies and discovery.</p></article>
          <article className="story-card"><span className="kicker">03 / Perspective</span><h3>The Universal Record</h3><p>Research announcements, scientific milestones and the record of discovery.</p></article>
        </div>
      </section>

      <ReaderRoadmap />

      <section className="newsletter-band">
        <div><span className="kicker">The ORBIT &amp; ORIGIN dispatch</span><h2>Stay curious. Look further.</h2><p>Receive new editions and carefully selected scientific stories.</p></div>
        <Link className="primary-link" href="/subscribe">Join the readership ↗</Link>
      </section>
    </>
  );
}
