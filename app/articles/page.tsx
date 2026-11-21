import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Article, ArticleDepartment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Articles",
  description: "Independent science reporting, astronomy, technology and the record of discovery.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type DeskVisual = {
  title: string;
  index: string;
  description: string;
  image: string;
  alt: string;
  credit: string;
  sourceUrl: string;
};

const departments: { value: ArticleDepartment; label: string }[] = [
  { value: "tapestry-of-worlds", label: "Tapestry of Worlds" },
  { value: "frontier-tech", label: "Frontier Tech" },
  { value: "universal-record", label: "The Universal Record" },
];

const deskVisuals: Record<ArticleDepartment, DeskVisual> = {
  "tapestry-of-worlds": {
    title: "Tapestry of Worlds",
    index: "01 / COSMOS",
    description: "Astronomy, astrophysics, cosmology and planetary science — exploring the universe from familiar worlds to distant frontiers.",
    image: "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia09/pia09109/PIA09109.jpg?crop=faces%2Cfocalpoint&fit=crop&h=1100&w=1600",
    alt: "A composite of the Pillars of the Eagle Nebula, combining Hubble visible-light and Spitzer infrared observations",
    credit: "NASA/JPL-Caltech/STScI/Institut d'Astrophysique Spatiale",
    sourceUrl: "https://science.nasa.gov/photojournal/unwrapping-the-pillars/",
  },
  "frontier-tech": {
    title: "Frontier Tech",
    index: "02 / INNOVATION",
    description: "The instruments, engineering and technologies that turn ambitious questions into measurable discoveries.",
    image: "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia15/pia15983/PIA15983.jpg?crop=faces%2Cfocalpoint&fit=crop&h=1100&w=1600",
    alt: "NASA's Curiosity rover and parachute as seen by the Mars Reconnaissance Orbiter during descent to Mars",
    credit: "NASA/JPL-Caltech/University of Arizona",
    sourceUrl: "https://science.nasa.gov/photojournal/curiosity-flying-over-mars/",
  },
  "universal-record": {
    title: "The Universal Record",
    index: "03 / PERSPECTIVE",
    description: "Research announcements, scientific milestones and the observations that change what we know about our place in the cosmos.",
    image: "https://images-assets.nasa.gov/image/PIA18033/PIA18033~large.jpg",
    alt: "Earth as seen in the Blue Marble image created from Suomi NPP satellite observations",
    credit: "NASA",
    sourceUrl: "https://science.nasa.gov/image-detail/amf-pia18033/",
  },
};

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function safeImage(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function teaser(body: string) {
  return body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 230);
}

export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params.q).trim().slice(0, 100);
  const requestedDepartment = param(params.department);
  const department = departments.some((item) => item.value === requestedDepartment)
    ? requestedDepartment as ArticleDepartment
    : null;
  const hasFilters = Boolean(q || department);

  let articles: Article[] = [];
  let available = true;

  try {
    const db = await createClient();
    let query = db.from("articles").select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (q) query = query.ilike("headline", "%" + q.replace(/[%_\\]/g, "\\$&") + "%");
    if (department) query = query.eq("department", department);
    const { data, error } = await query;
    if (error) throw error;
    articles = (data || []) as Article[];
  } catch {
    available = false;
  }

  const featured = articles[0] ?? null;
  const remaining = articles.slice(1);

  return (
    <main className="oo-articles">
      <header className="oo-articles-hero">
        <div className="oo-articles-hero-copy">
          <span className="oo-eyebrow">THE EDITORIAL DESK · ORBIT &amp; ORIGIN</span>
          <h1>Ideas, evidence<br/><em>and discovery.</em></h1>
          <p>
            Reporting that begins with a question, follows the evidence and leaves room for wonder.
            Explore astronomy, frontier technology and the scientific record.
          </p>
          <div className="oo-articles-principles" aria-label="Editorial principles">
            <span>Curiosity first</span><span>Evidence always</span><span>Clarity for everyone</span>
          </div>
          <a className="oo-articles-discover" href="#published-stories">Explore the editorial desk <span aria-hidden="true">↓</span></a>
        </div>
        <figure className="oo-articles-hero-art">
          {/* NASA image; the caption links to the credited source. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia09/pia09109/PIA09109.jpg?crop=faces%2Cfocalpoint&fit=crop&h=1100&w=1600" alt="A composite view of the Pillars of the Eagle Nebula in visible and infrared light" fetchPriority="high"/>
          <div className="oo-articles-hero-art-copy">
            <span>HUBBLE SPACE TELESCOPE · EAGLE NEBULA</span>
            <strong>Look closer.<br/><em>Ask better questions.</em></strong>
          </div>
          <figcaption><span>Star formation · M16</span><a href="https://science.nasa.gov/photojournal/unwrapping-the-pillars/" target="_blank" rel="noopener noreferrer">NASA / ESA / STScI ↗</a></figcaption>
        </figure>
      </header>

      <section className="oo-articles-manifesto">
        <div>
          <span className="oo-eyebrow">THREE EDITORIAL DESKS</span>
          <h2>One universe.<br/><em>Many ways to understand it.</em></h2>
        </div>
        <p>Each desk has its own perspective, but the same standard: explain what is known, distinguish it from what is still being investigated, and show readers where the evidence leads.</p>
      </section>

      <section className="oo-articles-desks" aria-label="Explore editorial departments">
        {departments.map((item) => {
          const visual = deskVisuals[item.value];
          return (
            <article className="oo-articles-desk" key={item.value}>
              <Link className="oo-articles-desk-art" href={"/articles?department=" + item.value} aria-label={"Browse " + visual.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visual.image} alt={visual.alt} loading="lazy"/>
                <span className="oo-articles-desk-number">{visual.index}</span>
                <span className="oo-articles-desk-arrow" aria-hidden="true">↗</span>
              </Link>
              <div className="oo-articles-desk-info">
                <h3><Link href={"/articles?department=" + item.value}>{visual.title}</Link></h3>
                <p>{visual.description}</p>
                <div className="oo-articles-image-credit"><span>{visual.credit}</span><a href={visual.sourceUrl} target="_blank" rel="noopener noreferrer">Image source ↗</a></div>
                <Link className="oo-articles-text-link" href={"/articles?department=" + item.value}>Explore this desk <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="oo-articles-library" id="published-stories" aria-labelledby="oo-articles-library-title">
        <div className="oo-articles-library-heading">
          <div><span className="oo-eyebrow">THE READING ROOM</span><h2 id="oo-articles-library-title">Stories, carefully considered.</h2></div>
          <p>Only articles that have passed editorial review appear in this library.</p>
        </div>

        <form method="get" action="/articles" className="oo-articles-filters" aria-label="Filter published articles">
          <label><span>Search headlines</span><input type="search" name="q" maxLength={100} defaultValue={q} placeholder="Search a subject or headline"/></label>
          <label><span>Editorial desk</span><select name="department" defaultValue={department || ""}><option value="">All departments</option>{departments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <button type="submit">Find articles <span aria-hidden="true">↗</span></button>
          {hasFilters && <Link href="/articles" className="oo-articles-clear">Clear filters</Link>}
        </form>

        {!available ? (
          <div className="oo-articles-state" role="status">
            <span className="oo-eyebrow">TEMPORARY INTERRUPTION</span>
            <h3>The editorial library is taking a pause.</h3>
            <p>Published articles could not be loaded just now. Please try again shortly.</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="oo-articles-empty">
            <div className="oo-articles-empty-copy">
              <span className="oo-eyebrow">{hasFilters ? "NO MATCHING STORIES" : "THE FIRST DISPATCH IS IN PREPARATION"}</span>
              <h3>{hasFilters ? "No published articles match this search." : "A good story begins with a careful look."}</h3>
              <p>{hasFilters
                ? "Try a broader search or choose another editorial desk."
                : "There are no published articles in the library yet. New reporting will appear here after it has been reviewed and published."}</p>
              <Link href={hasFilters ? "/articles" : "/observatory"}>{hasFilters ? "Clear the filters ↗" : "Explore the Science Observatory ↗"}</Link>
            </div>
            <figure className="oo-articles-empty-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia09/pia09109/PIA09109.jpg?crop=faces%2Cfocalpoint&fit=crop&h=1100&w=1600" alt="The Pillars of Creation, a region where stars are forming" loading="lazy"/>
              <figcaption>New stars taking shape in the Eagle Nebula · NASA / ESA / STScI</figcaption>
            </figure>
          </div>
        ) : (
          <div className="oo-articles-feed">
            {featured && (() => {
              const visual = deskVisuals[featured.department] || deskVisuals["tapestry-of-worlds"];
              const articleImage = featured.images?.find((image) => safeImage(image.url));
              const image = safeImage(articleImage?.url) || visual.image;
              const date = dateLabel(featured.published_at);
              return (
                <article className="oo-articles-feature" key={featured.id}>
                  <Link className="oo-articles-feature-art" href={"/articles/" + featured.slug} aria-label={"Read " + featured.headline}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={articleImage?.alt || visual.alt} loading="lazy"/>
                    <span>THE LATEST DISPATCH</span>
                  </Link>
                  <div className="oo-articles-feature-copy">
                    <span className="oo-eyebrow">{departments.find((item) => item.value === featured.department)?.label}</span>
                    <h3><Link href={"/articles/" + featured.slug}>{featured.headline}</Link></h3>
                    <p className="oo-articles-byline">By {featured.author}{date ? " · " + date : ""}</p>
                    <p className="oo-articles-feature-teaser">{teaser(featured.body_markdown)}{featured.body_markdown.length > 230 ? "…" : ""}</p>
                    <Link className="oo-articles-read-link" href={"/articles/" + featured.slug}>Read the full story <span aria-hidden="true">↗</span></Link>
                  </div>
                </article>
              );
            })()}
            {remaining.length > 0 && (
              <div className="oo-articles-story-grid">
                {remaining.map((article, index) => {
                  const visual = deskVisuals[article.department] || deskVisuals["tapestry-of-worlds"];
                  const articleImage = article.images?.find((image) => safeImage(image.url));
                  const image = safeImage(articleImage?.url) || visual.image;
                  return (
                    <article className="oo-articles-story" key={article.id}>
                      <Link className="oo-articles-story-art" href={"/articles/" + article.slug} aria-label={"Read " + article.headline}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={articleImage?.alt || visual.alt} loading="lazy"/>
                        <span>{String(index + 2).padStart(2, "0")}</span>
                      </Link>
                      <div className="oo-articles-story-copy">
                        <span className="oo-eyebrow">{visual.title}</span>
                        <h3><Link href={"/articles/" + article.slug}>{article.headline}</Link></h3>
                        <p className="oo-articles-byline">By {article.author}{dateLabel(article.published_at) ? " · " + dateLabel(article.published_at) : ""}</p>
                        <p>{teaser(article.body_markdown)}{article.body_markdown.length > 230 ? "…" : ""}</p>
                        <Link className="oo-articles-read-link" href={"/articles/" + article.slug}>Read story <span aria-hidden="true">↗</span></Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="oo-articles-footer-note">
        <span className="oo-eyebrow">OUR EDITORIAL PROMISE</span>
        <p>Accuracy before sensationalism. Sources before speculation. Wonder without exaggeration.</p>
      </footer>
    </main>
  );
}
