import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ArticleBody from "@/components/article-body";
import type { Article, ArticleDepartment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

const departmentLabels: Record<ArticleDepartment, string> = {
  "tapestry-of-worlds": "Tapestry of Worlds",
  "frontier-tech": "Frontier Tech",
  "universal-record": "The Universal Record",
};

const departmentImages: Record<ArticleDepartment, { url: string; alt: string; credit: string }> = {
  "tapestry-of-worlds": {
    url: "https://images-assets.nasa.gov/image/PIA20051/PIA20051~large.jpg",
    alt: "The Pillars of Creation in the Eagle Nebula",
    credit: "NASA, ESA and the Hubble Heritage Team",
  },
  "frontier-tech": {
    url: "https://images-assets.nasa.gov/image/PIA14897/PIA14897~large.jpg",
    alt: "NASA Curiosity rover exploring Mars",
    credit: "NASA / JPL-Caltech",
  },
  "universal-record": {
    url: "https://images-assets.nasa.gov/image/PIA18033/PIA18033~large.jpg",
    alt: "Earth in NASA's Blue Marble image",
    credit: "NASA",
  },
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB", { dateStyle: "long" });
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const db = await createClient();
  const { data } = await db.from("articles").select("headline").eq("slug", slug).eq("status", "published").maybeSingle();
  return {
    title: data?.headline || "Article",
    description: data?.headline ? data.headline + " — ORBIT & ORIGIN" : "Science reporting from ORBIT & ORIGIN.",
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const db = await createClient();
  const { data, error } = await db.from("articles").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error("Could not load article.");
  if (!data) notFound();

  const article = data as Article;
  const visual = departmentImages[article.department] || departmentImages["tapestry-of-worlds"];
  const leadImage = article.images?.find((image) => {
    try { return new URL(image.url).protocol === "https:"; } catch { return false; }
  });
  const heroImage = leadImage?.url || visual.url;

  return (
    <main className="oo-article-detail">
      <nav className="oo-article-back" aria-label="Article navigation">
        <Link href="/articles">← Back to the editorial desk</Link>
        <span>ORBIT &amp; ORIGIN · INDEPENDENT SCIENCE</span>
      </nav>

      <header className="oo-article-detail-header">
        <span className="oo-eyebrow">{departmentLabels[article.department]}</span>
        <h1>{article.headline}</h1>
        <div className="oo-article-detail-byline">
          <span>Written by {article.author}</span>
          {formatDate(article.published_at) && <time dateTime={article.published_at || undefined}>{formatDate(article.published_at)}</time>}
          <span>ORBIT &amp; ORIGIN</span>
        </div>
      </header>

      <figure className="oo-article-detail-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt={leadImage?.alt || visual.alt} fetchPriority="high"/>
        <figcaption>
          <span>{leadImage?.caption || visual.alt}</span>
          <span>{visual.credit}</span>
        </figcaption>
      </figure>

      <div className="oo-article-detail-layout">
        <aside className="oo-article-detail-aside">
          <span className="oo-eyebrow">FROM THE EDITORIAL DESK</span>
          <p>Curiosity first. Evidence always. Clarity for everyone.</p>
          <Link href={"/articles?department=" + article.department}>More from {departmentLabels[article.department]} ↗</Link>
        </aside>
        <div className="oo-article-detail-content">
          <ArticleBody markdown={article.body_markdown}/>
          {article.images?.filter((image) => image.url !== leadImage?.url).map((image, index) => (
            <figure className="oo-article-inline-image" key={image.url + "-" + index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt} loading="lazy"/>
              {image.caption && <figcaption>{image.caption}</figcaption>}
            </figure>
          ))}
          {article.source_references?.length > 0 && (
            <section className="oo-article-sources">
              <span className="oo-eyebrow">FURTHER READING</span>
              <h2>Sources and references</h2>
              <ol>
                {article.source_references.map((source, index) => (
                  <li key={source.url + "-" + index}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
                    {source.accessed_at && <span>Accessed {source.accessed_at}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <div className="oo-article-endnote">
            <span>END OF DISPATCH</span>
            <Link href="/articles">Continue exploring the editorial desk ↗</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
