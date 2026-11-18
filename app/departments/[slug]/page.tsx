import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { searchNasaImage } from "@/lib/science/nasa-images";
import type { ArticleDepartment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const departments: Record<ArticleDepartment, {
  number:string; title:string; subtitle:string; description:string;
  themes:string[]; imageQuery:string; imageAlt:string;
}> = {
  "tapestry-of-worlds": {
    number:"01", title:"Tapestry of Worlds", subtitle:"The universe, observed and understood.",
    description:"Astronomy, astrophysics, cosmology, planetary science and space exploration. We follow evidence from our Solar System to the distant universe, placing new observations in their scientific context.",
    themes:["Astronomy & observing","Stars, galaxies & black holes","Cosmology & fundamental physics","Planetary science & exploration"],
    imageQuery:"spiral galaxy nebula star formation NASA", imageAlt:"Astronomy and galaxy image from NASA",
  },
  "frontier-tech": {
    number:"02", title:"Frontier Tech", subtitle:"The instruments and ideas shaping tomorrow.",
    description:"Scientific innovation, engineering, emerging technologies, research instruments and computing. We examine how new tools are built, what they can measure and where their limits lie.",
    themes:["Spaceflight & aerospace","Scientific instruments","Computing & simulation","Engineering & emerging research"],
    imageQuery:"NASA space telescope engineering spacecraft James Webb", imageAlt:"Space technology image from NASA",
  },
  "universal-record": {
    number:"03", title:"The Universal Record", subtitle:"A considered record of scientific progress.",
    description:"Discoveries, research announcements, historical milestones, awards and important events. Every story should lead back to its original evidence and clearly distinguish results from interpretation.",
    themes:["Research announcements","Scientific history","Milestones & awards","Events and the research calendar"],
    imageQuery:"NASA scientific discovery astronomy observatory research", imageAlt:"Scientific discovery image from NASA",
  },
};

type ArticleRow = {
  id:string; slug:string; headline:string; author:string; body_markdown:string;
  images:{url?:string;alt?:string;caption?:string}[] | null; published_at:string | null;
};

function excerpt(value:string) {
  return value.replace(/^#{1,6}\s+/gm,"").replace(/!\[[^\]]*\]\([^)]*\)/g,"")
    .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/[*_~>`]/g,"")
    .replace(/\s+/g," ").trim().slice(0,260);
}

function safeImage(images:ArticleRow["images"]) {
  const candidate = Array.isArray(images) ? images.find(item => typeof item?.url === "string") : null;
  if (!candidate?.url) return null;
  try {
    const url = new URL(candidate.url);
    return url.protocol === "https:" ? {url:url.toString(),alt:(candidate.alt || "").slice(0,220)} : null;
  } catch { return null; }
}

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const {slug} = await params;
  if (!Object.prototype.hasOwnProperty.call(departments, slug)) notFound();
  const department = departments[slug as ArticleDepartment];
  let articles:ArticleRow[] = [];
  let unavailable = false;
  try {
    const db = await createClient();
    const {data,error} = await db.from("articles")
      .select("id,slug,headline,author,body_markdown,images,published_at")
      .eq("department",slug).eq("status","published")
      .order("published_at",{ascending:false}).limit(8);
    if(error) throw error;
    articles = (data || []) as ArticleRow[];
  } catch { unavailable = true; }

  const artwork = await searchNasaImage(department.imageQuery);
  const dateLabel = (value:string|null) => value
    ? new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(new Date(value))
    : "Publication date not supplied";

  return (
    <main className="oo-department-page">
      <header className="oo-department-hero">
        <div className="oo-department-hero-copy">
          <span className="kicker">{department.number} / Editorial department</span>
          <h1>{department.title}</h1>
          <p className="oo-department-subtitle">{department.subtitle}</p>
          <p className="muted">{department.description}</p>
        </div>
        <figure className="oo-department-art">
          {artwork ? <img src={artwork.imageUrl} alt={department.imageAlt} /> : <div className="oo-department-art-fallback"><span>ORBIT &amp; ORIGIN</span><strong>{department.title}</strong></div>}
          {artwork && <figcaption>NASA Image and Video Library · <a href={artwork.pageUrl} target="_blank" rel="noreferrer">{artwork.title} ↗</a></figcaption>}
        </figure>
      </header>

      <section className="oo-department-themes" aria-label="Department coverage">
        {department.themes.map((theme,index)=><span key={theme}><small>0{index+1}</small>{theme}</span>)}
      </section>

      <section className="oo-digest-section" aria-labelledby="oo-digest-heading">
        <header className="oo-digest-heading">
          <div><span className="kicker">THE DAILY DESK · PUBLISHED BRIEFINGS</span><h2 id="oo-digest-heading">Latest dispatches.</h2></div>
          <p className="muted">A visual reading list of the latest stories released by the editorial desk. Each entry links to its complete article and original references.</p>
        </header>
        {unavailable ? (
          <p className="oo-digest-empty" role="status">The editorial feed is temporarily unavailable. Please return shortly.</p>
        ) : articles.length === 0 ? (
          <p className="oo-digest-empty">No briefings have been published in this department yet. New stories will appear here when they are reviewed and published in the Founder Workspace.</p>
        ) : (
          <>
            <div className="oo-digest-table-wrap">
              <table className="oo-digest-table">
                <thead><tr><th>Date</th><th>Briefing</th><th>By</th><th>Read</th></tr></thead>
                <tbody>{articles.map(article=><tr key={article.id}>
                  <td>{dateLabel(article.published_at)}</td><td><Link href={"/articles/"+article.slug}>{article.headline}</Link></td>
                  <td>{article.author}</td><td><Link href={"/articles/"+article.slug}>Open ↗</Link></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="oo-digest-grid">
              {articles.map(article=>{
                const image=safeImage(article.images) || (artwork ? {url:artwork.imageUrl,alt:department.imageAlt} : null);
                return <article className="oo-digest-card" key={article.id}>
                  {image ? <Link href={"/articles/"+article.slug} className="oo-digest-image"><img src={image.url} alt={image.alt || article.headline} loading="lazy"/></Link> : <div className="oo-digest-image oo-digest-image-placeholder"><span>EDITORIAL BRIEFING</span></div>}
                  <div className="oo-digest-card-copy">
                    <span className="kicker">{department.title} · {dateLabel(article.published_at)}</span>
                    <h3><Link href={"/articles/"+article.slug}>{article.headline}</Link></h3>
                    <p>{excerpt(article.body_markdown)}</p><span className="oo-digest-byline">By {article.author}</span>
                    <Link className="oo-digest-read" href={"/articles/"+article.slug}>Read the briefing ↗</Link>
                  </div>
                </article>;
              })}
            </div>
          </>
        )}
      </section>
      <footer className="oo-department-footer"><Link href="/articles">Explore all published articles ↗</Link><Link href="/latest">Read the latest edition ↗</Link></footer>
    </main>
  );
}
