const milestones = [
  {
    step: "01",
    label: "NEXT PR · READER EXPERIENCE",
    title: "A more capable issue reader",
    description:
      "A purpose-built reading experience for desktop and mobile, with clearer navigation through an edition, more considered reading controls and a dependable PDF fallback.",
  },
  {
    step: "02",
    label: "FOLLOWING PR · EDITION DELIVERY",
    title: "The ORBIT & ORIGIN dispatch",
    description:
      "A consent-first email system that delivers each newly published edition to confirmed subscribers, with a direct route to the online reader and PDF, plus secure unsubscribe and delivery safeguards.",
  },
];

export default function ReaderRoadmap() {
  return (
    <section className="reader-roadmap" aria-labelledby="reader-roadmap-title">
      <div className="reader-roadmap-heading">
        <div>
          <span className="kicker">The next chapters</span>
          <h2 id="reader-roadmap-title">The reading experience keeps moving forward.</h2>
        </div>
        <p>
          Two upcoming builds have one shared purpose: make every edition easier
          to read, and easier to receive.
        </p>
      </div>

      <div className="reader-roadmap-grid">
        {milestones.map((milestone) => (
          <article className="reader-roadmap-card" key={milestone.step}>
            <div className="reader-roadmap-card-top">
              <span className="reader-roadmap-step">{milestone.step}</span>
              <span className="reader-roadmap-label">{milestone.label}</span>
            </div>
            <h3>{milestone.title}</h3>
            <p>{milestone.description}</p>
          </article>
        ))}
      </div>
      <p className="reader-roadmap-note">
        These are planned development milestones; each pull request will be
        reviewed before its changes are released.
      </p>
    </section>
  );
}
