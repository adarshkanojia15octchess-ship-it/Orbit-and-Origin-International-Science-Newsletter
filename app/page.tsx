import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";
import HomeCinematicHero from "@/components/home-cinematic-hero";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "ORBIT & ORIGIN — Exploring the Universe",
  description: "An independent science and astronomy publication exploring the Universe with curiosity, editorial care and a commitment to evidence.",
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

const departments = [
  {
    number: "01",
    label: "COSMOS · ASTRONOMY",
    title: "Tapestry of Worlds",
    description: "From the architecture of galaxies to the worlds in our own Solar System, follow the science that reveals where we fit in the Universe.",
    href: "/departments/tapestry-of-worlds",
    image: "https://svs.gsfc.nasa.gov/vis/a010000/a013800/a013846/13846_NEBULA_WIDE_THUMB.jpg",
    imageAlt: "Hubble views of star-forming nebulae",
    credit: "NASA's Goddard Space Flight Center · Hubble",
    action: "Explore the cosmos",
    className: "home-department-tapestry",
  },
  {
    number: "02",
    label: "ENGINEERING · INNOVATION",
    title: "Frontier Tech",
    description: "Meet the instruments, ideas and engineering that turn difficult questions into new ways of observing, measuring and exploring.",
    href: "/departments/frontier-tech",
    image: "https://images-assets.nasa.gov/image/iss036e029140/iss036e029140~small.jpg",
    imageAlt: "Robonaut robotics demonstration aboard the International Space Station",
    credit: "NASA · International Space Station",
    action: "Discover the frontier",
    className: "home-department-frontier",
  },
  {
    number: "03",
    label: "DISCOVERY · PERSPECTIVE",
    title: "The Universal Record",
    description: "A considered record of discoveries, research milestones and the observations that steadily change our picture of reality.",
    href: "/departments/universal-record",
    image: "https://images-assets.nasa.gov/image/PIA12110/PIA12110~orig.jpg",
    imageAlt: "The Hubble Deep Field, filled with distant galaxies",
    credit: "NASA · JPL · STScI Hubble Deep Field Team",
    action: "Read the record",
    className: "home-department-record",
  },
];

const destinations = [
  {
    number: "A",
    label: "THE EDITORIAL DESK",
    title: "Articles",
    description: "Reporting, explanations and essays shaped by evidence and a sense of perspective.",
    href: "/articles",
    action: "Read the articles",
  },
  {
    number: "B",
    label: "THE RESEARCH WORKBENCH",
    title: "Science Observatory",
    description: "Explore scientific data, mission updates, papers and the measurements behind discovery.",
    href: "/observatory",
    action: "Enter the observatory",
  },
  {
    number: "C",
    label: "THE INTERACTIVE SKY",
    title: "Sky Explorer",
    description: "Move from our planetary neighbourhood to stars, nebulae and distant galaxies.",
    href: "/sky-explorer",
    action: "Explore the sky",
  },
  {
    number: "D",
    label: "THE READING ROOM",
    title: "Issue Archive",
    description: "Return to every published edition and read the original journal in its own time.",
    href: "/issues",
    action: "Browse editions",
  },
];

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
    // Keep the homepage available if the publication database is temporarily unavailable.
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const cover = latestIssue?.cover_image_url && isPublishedStorageAsset(latestIssue.cover_image_url, projectUrl)
    ? latestIssue.cover_image_url
    : null;
  const issueLabel = latestIssue ? String(latestIssue.issue_number).padStart(3, "0") : null;

  return (
    <main className="home-page">
      <HomeCinematicHero />

      <section className="home-editorial-intro" aria-labelledby="home-editorial-title">
        <div className="home-editorial-index">
          <span>THE ORBIT &amp; ORIGIN POINT OF VIEW</span>
          <span>EST. 2026 · INDEPENDENT SCIENCE PUBLISHING</span>
        </div>
        <div className="home-editorial-statement">
          <h2 id="home-editorial-title">Wonder opens the door.<br /><em>Evidence lights the way.</em></h2>
          <p>
            We believe a science publication should do more than pass along information.
            It should give discoveries context, make difficult ideas approachable and leave
            readers with better questions than the ones they arrived with.
          </p>
        </div>
      </section>

      <section className="home-latest" aria-labelledby="home-latest-title">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">THE READING ROOM · LATEST EDITION</span>
            <h2 id="home-latest-title">A new window<br /><em>on the Universe.</em></h2>
          </div>
          <p>Thoughtfully assembled editions for readers who want to look closer, understand more and keep following the evidence.</p>
        </div>

        <div className="home-latest-feature">
          <div
            className={"home-latest-art" + (cover ? " has-cover" : "")}
            style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(4,12,22,.08),rgba(4,12,22,.02)),url(" + JSON.stringify(cover) + ")" } : undefined}
            role="img"
            aria-label={cover
              ? `Cover artwork for ORBIT & ORIGIN Issue ${issueLabel}, ${latestIssue?.title}`
              : latestIssue
                ? `Editorial artwork for Issue ${issueLabel}, ${latestIssue.title}`
                : "ORBIT & ORIGIN editorial artwork: The Universe Awaits"}
          >
            {!cover && (
              <>
                <span className="home-latest-masthead">ORBIT <i>&amp;</i> ORIGIN</span>
                <span className="home-latest-edition">{latestIssue ? `EDITION ${issueLabel}` : "THE READING ROOM"}</span>
                <strong>{latestIssue ? latestIssue.title : <>THE<br />UNIVERSE<br /><em>AWAITS</em></>}</strong>
                <span className="home-latest-foot">OPEN TO CURIOSITY · COMMITTED TO EVIDENCE</span>
              </>
            )}
          </div>

          <div className="home-latest-copy">
            {latestIssue ? (
              <>
                <div className="home-issue-meta">
                  <span>ISSUE {issueLabel}</span>
                  <time dateTime={latestIssue.publication_date}>{formatPublicationDate(latestIssue.publication_date)}</time>
                </div>
                <h3>{latestIssue.title}</h3>
                <p>{latestIssue.description}</p>
                <Link className="home-text-link" href="/latest">Read the latest edition <span>↗</span></Link>
                <p className="home-latest-archive-note">The complete collection lives in the <Link href="/issues">issue archive</Link>.</p>
              </>
            ) : (
              <>
                <span className="home-eyebrow">THE EDITORIAL LIBRARY</span>
                <h3 id="home-latest-title-fallback">The next discovery starts here.</h3>
                <p>Explore the publication&apos;s reading room and return as new editions are released.</p>
                <Link className="home-text-link" href="/issues">Explore the issue archive <span>↗</span></Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="home-departments" aria-labelledby="home-departments-title">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">THREE EDITORIAL DEPARTMENTS</span>
            <h2 id="home-departments-title">Three ways to<br /><em>read discovery.</em></h2>
          </div>
          <p>Each department approaches the same great endeavour from a different direction: understanding the world through science.</p>
        </div>

        <div className="home-department-grid">
          {departments.map((department) => (
            <Link className={`home-department-card ${department.className}`} href={department.href} key={department.number}>
              <div
                className="home-department-image"
                style={{ backgroundImage: `url("${department.image}")` }}
                role="img"
                aria-label={department.imageAlt}
              />
              <div className="home-department-shade" />
              <div className="home-department-top">
                <span>{department.number} / {department.label}</span>
                <span aria-hidden="true">↗</span>
              </div>
              <div className="home-department-copy">
                <h3>{department.title}</h3>
                <p>{department.description}</p>
                <span className="home-department-action">{department.action} <b>↗</b></span>
              </div>
              <small className="home-department-credit">{department.credit}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-destinations" aria-labelledby="home-destinations-title">
        <div className="home-section-head">
          <div>
            <span className="home-eyebrow">EXPLORE THE PUBLICATION</span>
            <h2 id="home-destinations-title">Find your next<br /><em>point of entry.</em></h2>
          </div>
          <p>Read a feature, inspect the data, explore the sky or settle into an edition. The journey is yours to shape.</p>
        </div>
        <div className="home-destination-grid">
          {destinations.map((destination) => (
            <Link className="home-destination-card" href={destination.href} key={destination.number}>
              <span className="home-destination-number">{destination.number}</span>
              <span className="home-eyebrow">{destination.label}</span>
              <h3>{destination.title}</h3>
              <p>{destination.description}</p>
              <span className="home-destination-action">{destination.action} <b>↗</b></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-editorial-promise" aria-labelledby="home-promise-title">
        <div className="home-promise-art">
          <span>ONE SMALL PATCH OF SKY.</span>
          <strong>THOUSANDS<br />OF GALAXIES.</strong>
          <a href="https://science.nasa.gov/image-detail/amf-pia12110/" target="_blank" rel="noopener noreferrer">Image: NASA · Hubble Deep Field ↗</a>
        </div>
        <div className="home-promise-copy">
          <span className="home-eyebrow">OUR EDITORIAL PROMISE</span>
          <h2 id="home-promise-title">A sense of wonder.<br /><em>A standard of care.</em></h2>
          <p>
            The scale of the cosmos invites extraordinary imagination. Our responsibility is
            to keep that imagination connected to what observations, research and careful
            reasoning can support.
          </p>
          <div className="home-promise-principles">
            <div><span>01</span><strong>Curiosity</strong><small>Ask questions worth pursuing.</small></div>
            <div><span>02</span><strong>Evidence</strong><small>Show what supports the story.</small></div>
            <div><span>03</span><strong>Perspective</strong><small>Make room for context and uncertainty.</small></div>
          </div>
          <Link className="home-text-link" href="/editorial-standards">Read our editorial standards <span>↗</span></Link>
        </div>
      </section>

      <section className="home-dispatch">
        <div>
          <span className="home-eyebrow">THE ORBIT &amp; ORIGIN DISPATCH</span>
          <h2>Stay curious.<br /><em>Keep looking up.</em></h2>
          <p>Receive new editions and carefully selected scientific stories, delivered with the same care that goes into every issue.</p>
        </div>
        <div className="home-dispatch-action">
          <Link className="home-dispatch-button" href="/subscribe">Join the readership <span>↗</span></Link>
          <small>Thoughtful science. No noise.</small>
        </div>
      </section>
    </main>
  );
}
