import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Article, Issue } from "@/lib/types";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";
import { PdfReader } from "@/src/editorial/pdf-reader";

type Props = { params: Promise<{ issueId: string }> };
export const metadata = { title: "Edition reader", description: "Read a published ORBIT & ORIGIN edition." };

const departmentLabels: Record<Article["department"], string> = {
  "tapestry-of-worlds": "Tapestry of Worlds",
  "frontier-tech": "Frontier Tech",
  "universal-record": "The Universal Record",
};

export default async function EditionReaderPage({ params }: Props) {
  const { issueId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueId)) notFound();

  let data: Issue | null = null;
  let relatedArticles: Article[] = [];
  try {
    const db = await createClient();
    const result = await db.from("issues").select("*").eq("id", issueId).eq("status", "published").maybeSingle();
    if (result.error) throw result.error;
    data = result.data as Issue | null;
    if (data) {
      const articlesResult = await db.from("articles").select("*")
        .eq("issue_id", issueId)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (!articlesResult.error) relatedArticles = (articlesResult.data || []) as Article[];
    }
  } catch {
    return (
      <main className="oo-reader-page">
        <div className="oo-reader-heading"><Link href="/issues" className="oo-eyebrow">← The archive</Link><h1>Reader temporarily unavailable.</h1><p className="oo-reader-description">The publication database could not be reached. Please try again shortly.</p></div>
      </main>
    );
  }
  if (!data) notFound();
  const issue = data;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!issue.pdf_url || !isPublishedStorageAsset(issue.pdf_url, projectUrl)) notFound();

  return (
    <article className="oo-reader-page">
      <div className="oo-reader-heading">
        <Link href="/issues" className="oo-eyebrow">← The archive</Link>
        <p className="oo-eyebrow">ORBIT &amp; ORIGIN · ISSUE {String(issue.issue_number).padStart(3, "0")}</p>
        <h1>{issue.title}</h1>
        <p className="oo-reader-description">{issue.description}</p>
        <p className="oo-reader-date">{new Date(issue.publication_date).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
      </div>
      <PdfReader url={issue.pdf_url} title={issue.title} downloadName={"orbit-and-origin-issue-" + String(issue.issue_number).padStart(3, "0") + ".pdf"}/>
      {relatedArticles.length > 0 && (
        <section className="section" aria-labelledby="issue-articles-heading">
          <div className="section-heading">
            <div>
              <span className="kicker">Beyond the edition · Issue {String(issue.issue_number).padStart(3, "0")}</span>
              <h2 id="issue-articles-heading">Continue exploring.</h2>
            </div>
            <p className="muted">Read the stories and analysis connected to this edition.</p>
          </div>
          <div className="grid">
            {relatedArticles.map((article) => (
              <article className="story-card" key={article.id}>
                <span className="kicker">{departmentLabels[article.department]}</span>
                <h3><Link href={"/articles/" + article.slug}>{article.headline}</Link></h3>
                <p className="muted">By {article.author}{article.published_at ? " · " + new Date(article.published_at).toLocaleDateString("en-US", { dateStyle: "long" }) : ""}</p>
                <Link href={"/articles/" + article.slug}>Read article ↗</Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
