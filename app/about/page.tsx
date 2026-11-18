import Link from "next/link";

export const metadata = {
  title: "About ORBIT & ORIGIN",
  description:
    "Discover the mission, departments and editorial principles behind ORBIT & ORIGIN — an independent science publication open to curiosity and committed to evidence.",
};

const departments = [
  {
    number: "01",
    name: "Tapestry of Worlds",
    theme: "THE COSMOS",
    description:
      "A closer look at astronomy, astrophysics, cosmology, planetary science and space exploration — from nearby worlds to the large-scale structure of the Universe.",
    href: "/departments/tapestry-of-worlds",
    symbol: "✳",
  },
  {
    number: "02",
    name: "Frontier Tech",
    theme: "THE TOOLS OF TOMORROW",
    description:
      "The instruments, engineering, computing and emerging technologies that extend what humanity can observe, measure and build.",
    href: "/departments/frontier-tech",
    symbol: "⌘",
  },
  {
    number: "03",
    name: "The Universal Record",
    theme: "THE RECORD OF DISCOVERY",
    description:
      "Important research, scientific milestones and discoveries placed in context — what happened, what the evidence tells us and why it matters.",
    href: "/departments/universal-record",
    symbol: "◎",
  },
];

const principles = [
  {
    number: "01 / EVIDENCE",
    title: "Start with what is known.",
    body: "We look to research papers, mission teams, observatories, scientific institutions and other credible sources. Important claims should be traceable.",
  },
  {
    number: "02 / CLARITY",
    title: "Make complexity approachable.",
    body: "We aim to explain difficult ideas in plain language without flattening the science or hiding the details that matter.",
  },
  {
    number: "03 / CONTEXT",
    title: "A discovery is more than a headline.",
    body: "We ask how a result was obtained, how it fits into existing knowledge and what questions remain open.",
  },
  {
    number: "04 / HUMILITY",
    title: "Be honest about uncertainty.",
    body: "Measurements have limits, models have assumptions and research develops. We distinguish established findings from interpretation and speculation.",
  },
];

export default function AboutPage() {
  return (
    <main className="oo-about-page">
      <section className="oo-about-hero" aria-labelledby="about-title">
        <div className="oo-about-hero-copy">
          <span className="kicker">ABOUT THE PUBLICATION · EST. 2026</span>
          <p className="oo-about-overline">OPEN TO CURIOSITY. COMMITTED TO EVIDENCE.</p>
          <h1 id="about-title">The Universe is vast.<br /><em>Understanding begins</em><br />with a question.</h1>
          <p className="oo-about-lede">
            ORBIT &amp; ORIGIN is an independent science publication exploring the cosmos, the technologies that help us investigate it, and the discoveries that reshape our understanding.
          </p>
          <div className="oo-about-actions">
            <Link className="primary-link" href="/issues">Explore the editions ↗</Link>
            <Link className="oo-about-text-link" href="/editorial-standards">Our editorial standards</Link>
          </div>
        </div>
        <div className="oo-about-cosmos-art" role="img" aria-label="Abstract orbital illustration representing exploration and scientific discovery">
          <div className="oo-about-art-label">A SMALL PLANET / A BIGGER PICTURE</div>
          <div className="oo-about-orbit oo-about-orbit-one" />
          <div className="oo-about-orbit oo-about-orbit-two" />
          <div className="oo-about-orbit oo-about-orbit-three" />
          <div className="oo-about-planet"><span /></div>
          <span className="oo-about-star oo-star-a">✦</span>
          <span className="oo-about-star oo-star-b">·</span>
          <span className="oo-about-star oo-star-c">✧</span>
          <span className="oo-about-art-caption">OBSERVE · QUESTION · UNDERSTAND</span>
        </div>
      </section>

      <section className="oo-about-manifesto" aria-label="Our guiding idea">
        <span className="kicker">WHY WE EXIST</span>
        <p>Science is not only a collection of answers. It is a way of asking better questions about the world — and our place in it.</p>
        <span className="oo-about-manifesto-mark">O&amp;O</span>
      </section>

      <section className="oo-about-section" aria-labelledby="departments-title">
        <div className="oo-about-section-heading">
          <div>
            <span className="kicker">THREE EDITORIAL WINDOWS</span>
            <h2 id="departments-title">One universe.<br /><em>Many ways to explore.</em></h2>
          </div>
          <p>Each department approaches discovery from a different direction. Together, they connect scientific ideas, the tools behind them and the record they leave.</p>
        </div>
        <div className="oo-about-departments">
          {departments.map((department) => (
            <article className="oo-about-department" key={department.number}>
              <div className="oo-about-dept-top">
                <span>{department.number} / {department.theme}</span>
                <span className="oo-about-dept-symbol" aria-hidden="true">{department.symbol}</span>
              </div>
              <h3>{department.name}</h3>
              <p>{department.description}</p>
              <Link href={department.href}>Explore department <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="oo-about-method" aria-labelledby="method-title">
        <div className="oo-about-method-heading">
          <span className="kicker">HOW WE APPROACH SCIENCE</span>
          <h2 id="method-title">Wonder, with<br /><em>its feet on the ground.</em></h2>
          <p>Beautiful ideas deserve careful treatment. Our editorial approach is designed to keep the excitement of discovery connected to the quality of the evidence.</p>
          <Link className="oo-about-text-link" href="/editorial-standards">Read the full editorial standards ↗</Link>
        </div>
        <div className="oo-about-principles">
          {principles.map((principle) => (
            <article className="oo-about-principle" key={principle.number}>
              <span>{principle.number}</span>
              <div>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="oo-about-reading" aria-labelledby="reading-title">
        <div>
          <span className="kicker">A PUBLICATION THAT KEEPS LOOKING</span>
          <h2 id="reading-title">Follow the questions.<br /><em>Follow the discoveries.</em></h2>
          <p>Read the latest edition, browse the archive or explore individual articles. Each story is an invitation to look a little closer.</p>
        </div>
        <div className="oo-about-reading-links">
          <Link href="/latest"><span>01</span><strong>Read the latest edition</strong><b>↗</b></Link>
          <Link href="/issues"><span>02</span><strong>Browse the issue archive</strong><b>↗</b></Link>
          <Link href="/articles"><span>03</span><strong>Explore individual articles</strong><b>↗</b></Link>
          <Link href="/observatory"><span>04</span><strong>Visit the Science Observatory</strong><b>↗</b></Link>
        </div>
      </section>

      <section className="oo-about-founder" aria-labelledby="founder-title">
        <div className="oo-about-founder-art">
          <img src="/images/founder-portrait.png" alt="Portrait of ORBIT & ORIGIN founder and editor Adarsh Kanojia" loading="lazy" />
          <span>FOUNDER &amp; EDITOR-IN-CHIEF</span>
        </div>
        <div className="oo-about-founder-copy">
          <span className="kicker">THE PERSON BEHIND THE PUBLICATION</span>
          <h2 id="founder-title">A curiosity that<br /><em>became a publication.</em></h2>
          <p>ORBIT &amp; ORIGIN was founded by Adarsh Kanojia, a student with a deep interest in astronomy, astrophysics and the wider scientific enterprise. The publication brings that curiosity into a shared space for readers who want to understand how discovery happens.</p>
          <p>Its ambition is simple: take science seriously, communicate it clearly and keep the door open to anyone willing to ask a thoughtful question.</p>
          <Link className="primary-link" href="/about/founder">Meet the founder ↗</Link>
        </div>
      </section>

      <section className="oo-about-closing">
        <span className="kicker">ORBIT &amp; ORIGIN</span>
        <h2>Look further.<br /><em>Stay curious.</em></h2>
        <p>Open to curiosity. Committed to evidence.</p>
        <Link className="primary-link" href="/issues">Begin exploring ↗</Link>
      </section>
    </main>
  );
}
