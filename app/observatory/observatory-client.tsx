"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type Tab = "apod" | "solar" | "exoplanets" | "papers";
type ApodData = {
  date: string; title: string; mediaType: string; explanation: string;
  imageUrl: string | null; alt: string; credit: string; pageUrl: string;
};
type SolarEvent = {
  id: string; type: string; category: "CME" | "FLR"; startTime: string | null;
  peakTime: string | null; endTime: string | null; classification: string | null;
  sourceLocation: string | null; note: string | null; sourceUrl: string | null;
};
type Planet = {
  name: string; hostName: string | null; discoveryMethod: string | null;
  discoveryYear: number | null; radiusEarth: number | null; massEarth: number | null;
  orbitalPeriodDays: number | null; distanceParsecs: number | null;
};
type Paper = {
  id: string; title: string; authors: string[]; abstract: string; submittedAt: string;
  updatedAt: string; url: string; categories: string[]; doi: string | null;
  journalReference: string | null; recordType: string;
};
type CrossrefCandidate = {
  title: string; doi: string; doiUrl: string; authors: string[]; publisher: string | null;
  journal: string | null; publicationDate: string | null; workType: string | null;
  sourceUrl: string; titleSimilarity: number; matchLabel: string;
};
type CrossrefResponse = { candidates: CrossrefCandidate[]; guidance: string };
type ApiError = { error?: string };

async function readApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const payload = await response.json() as T & ApiError;
  if (!response.ok) throw new Error(payload.error || "The data service could not complete the request.");
  return payload;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Date not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function numberLabel(value: number | null, suffix = "") {
  return value === null ? "Not reported" : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value) + suffix;
}

const methods = [
  "Transit", "Radial Velocity", "Imaging", "Microlensing", "Astrometry",
  "Orbital Brightness Modulation", "Pulsar Timing", "Eclipse Timing Variations",
  "Pulsation Timing Variations", "Disk Kinematics",
];

export default function ObservatoryClient() {
  const [tab, setTab] = useState<Tab>("apod");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrievedAt, setRetrievedAt] = useState("");

  const [apod, setApod] = useState<ApodData | null>(null);
  const [solarEvents, setSolarEvents] = useState<SolarEvent[]>([]);
  const [solarPartial, setSolarPartial] = useState(false);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [planetQueryDraft, setPlanetQueryDraft] = useState("");
  const [planetMethodDraft, setPlanetMethodDraft] = useState("");
  const [planetQuery, setPlanetQuery] = useState("");
  const [planetMethod, setPlanetMethod] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [paperTotal, setPaperTotal] = useState(0);
  const [paperQueryDraft, setPaperQueryDraft] = useState("cosmology");
  const [paperCategoryDraft, setPaperCategoryDraft] = useState("astrophysics");
  const [paperQuery, setPaperQuery] = useState("cosmology");
  const [paperCategory, setPaperCategory] = useState("astrophysics");
  const [crossrefByPaper, setCrossrefByPaper] = useState<Record<string, CrossrefResponse>>({});
  const [crossrefLoading, setCrossrefLoading] = useState("");

  useEffect(() => {
    if (tab !== "apod") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    readApi<{ data: ApodData; retrievedAt: string }>("/api/science/apod", controller.signal)
      .then((result) => {
        setApod(result.data);
        setRetrievedAt(result.retrievedAt);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "NASA APOD is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab]);

  useEffect(() => {
    if (tab !== "solar") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    readApi<{ events: SolarEvent[]; partial: boolean; retrievedAt: string }>("/api/science/solar?days=7", controller.signal)
      .then((result) => {
        setSolarEvents(result.events);
        setSolarPartial(result.partial);
        setRetrievedAt(result.retrievedAt);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "NASA space-weather data is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab]);

  useEffect(() => {
    if (tab !== "exoplanets") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (planetQuery) params.set("q", planetQuery);
    if (planetMethod) params.set("method", planetMethod);
    readApi<{ planets: Planet[]; retrievedAt: string }>("/api/science/exoplanets?" + params.toString(), controller.signal)
      .then((result) => {
        setPlanets(result.planets);
        setRetrievedAt(result.retrievedAt);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The Exoplanet Archive is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, planetQuery, planetMethod]);

  useEffect(() => {
    if (tab !== "papers") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: paperQuery, category: paperCategory });
    readApi<{ papers: Paper[]; totalResults: number; retrievedAt: string }>("/api/science/papers?" + params.toString(), controller.signal)
      .then((result) => {
        setPapers(result.papers);
        setPaperTotal(result.totalResults);
        setRetrievedAt(result.retrievedAt);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "arXiv is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, paperQuery, paperCategory]);

  function submitPlanetSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlanetQuery(planetQueryDraft.trim());
    setPlanetMethod(planetMethodDraft);
  }

  function submitPaperSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paperQueryDraft.trim().length < 2) {
      setError("Enter at least two characters to search research papers.");
      return;
    }
    setPaperQuery(paperQueryDraft.trim());
    setPaperCategory(paperCategoryDraft);
  }

  async function lookupPublication(paper: Paper) {
    setCrossrefLoading(paper.id);
    setError("");
    try {
      const params = new URLSearchParams({
        title: paper.title,
        author: paper.authors[0] || "",
      });
      const result = await readApi<CrossrefResponse>("/api/science/publications?" + params.toString());
      setCrossrefByPaper((current) => ({ ...current, [paper.id]: result }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Crossref could not be reached.");
    } finally {
      setCrossrefLoading("");
    }
  }

  return (
    <section className="oo-observatory-workbench" aria-label="Scientific data tools">
      <div className="oo-observatory-tabs" role="tablist" aria-label="Choose a science tool">
        <button type="button" role="tab" aria-selected={tab === "apod"} className={tab === "apod" ? "is-active" : ""} onClick={() => setTab("apod")}>NASA · APOD</button>
        <button type="button" role="tab" aria-selected={tab === "solar"} className={tab === "solar" ? "is-active" : ""} onClick={() => setTab("solar")}>Solar activity</button>
        <button type="button" role="tab" aria-selected={tab === "exoplanets"} className={tab === "exoplanets" ? "is-active" : ""} onClick={() => setTab("exoplanets")}>Exoplanet Atlas</button>
        <button type="button" role="tab" aria-selected={tab === "papers"} className={tab === "papers" ? "is-active" : ""} onClick={() => setTab("papers")}>Research Radar</button>
      </div>

      {loading && <p className="oo-observatory-status" role="status">Retrieving scientific data from the original provider…</p>}
      {error && <p className="oo-observatory-error" role="alert">{error}</p>}

      {tab === "apod" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-apod-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">NASA · ASTRONOMY PICTURE OF THE DAY</span><h2 id="oo-apod-title">A window on the Universe.</h2></div>
            <span className="oo-observatory-source-mark">NASA</span>
          </div>
          {apod && (
            <div className="oo-apod-layout">
              <div className="oo-apod-art">
                {apod.imageUrl ? (
                  <Image src={apod.imageUrl} alt={apod.alt} width={1200} height={900} sizes="(max-width: 800px) 100vw, 60vw" />
                ) : (
                  <div className="oo-observatory-placeholder"><span>{apod.mediaType.toUpperCase()}</span><p>This entry is not a still image, or NASA did not supply a full-size image. Open the original NASA feature to view its media.</p></div>
                )}
              </div>
              <div className="oo-apod-copy">
                <p className="oo-observatory-date">{dateLabel(apod.date)} · NASA APOD</p>
                <h3>{apod.title}</h3>
                <p>{apod.explanation}</p>
                {apod.credit && <p className="oo-observatory-credit">Image credit: {apod.credit}</p>}
                <a className="oo-observatory-text-link" href={apod.pageUrl} target="_blank" rel="noreferrer">Open the original NASA feature ↗</a>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "solar" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-solar-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">NASA DONKI · PREVIOUS SEVEN DAYS</span><h2 id="oo-solar-title">The active Sun.</h2></div>
            <span className="oo-observatory-source-mark">SPACE WEATHER</span>
          </div>
          {solarPartial && <p className="oo-observatory-note">One NASA event feed was unavailable. The events shown below come from the feed that responded.</p>}
          {!loading && !solarEvents.length && !error && <p className="oo-observatory-note">No CME or solar-flare records were returned for this period. This does not mean the Sun was inactive; this panel displays the selected DONKI event types only.</p>}
          <div className="oo-observatory-event-list">
            {solarEvents.map((event) => (
              <article className="oo-observatory-event" key={event.id}>
                <div className="oo-observatory-event-top"><span>{event.category}</span><time>{dateLabel(event.startTime)}</time></div>
                <h3>{event.type}{event.classification ? " · " + event.classification : ""}</h3>
                <p>{event.sourceLocation ? "Source location: " + event.sourceLocation + ". " : ""}{event.peakTime ? "Peak: " + dateLabel(event.peakTime) + ". " : ""}{event.note || "NASA DONKI event record."}</p>
                {event.sourceUrl && <a className="oo-observatory-text-link" href={event.sourceUrl} target="_blank" rel="noreferrer">NASA event analysis ↗</a>}
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">DONKI records include observations, analysis and model-linked event information. This list is not a forecast or an alert service.</p>
        </section>
      )}

      {tab === "exoplanets" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-exoplanets-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">NASA EXOPLANET ARCHIVE · PSCOMPPars</span><h2 id="oo-exoplanets-title">Worlds beyond our Sun.</h2></div>
            <span className="oo-observatory-source-mark">EXOPLANETS</span>
          </div>
          <form className="oo-observatory-filters" onSubmit={submitPlanetSearch}>
            <label>Planet or host star<input value={planetQueryDraft} onChange={(event) => setPlanetQueryDraft(event.target.value)} maxLength={80} placeholder="e.g. TRAPPIST-1" /></label>
            <label>Discovery method<select value={planetMethodDraft} onChange={(event) => setPlanetMethodDraft(event.target.value)}><option value="">All methods</option>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <button type="submit">Search catalogue ↗</button>
          </form>
          {!loading && <p className="oo-observatory-results-count">{planets.length} archive records returned. The table is a live, bounded query of NASA Exoplanet Archive composite parameters.</p>}
          <div className="oo-planet-grid">
            {planets.map((planet) => (
              <article className="oo-planet-card" key={planet.name}>
                <span className="oo-eyebrow">{planet.discoveryMethod || "Discovery method not reported"}</span>
                <h3>{planet.name}</h3>
                <p className="oo-planet-host">Host star · {planet.hostName || "Not reported"}</p>
                <dl>
                  <div><dt>Discovery year</dt><dd>{planet.discoveryYear ?? "—"}</dd></div>
                  <div><dt>Radius</dt><dd>{numberLabel(planet.radiusEarth, " R⊕")}</dd></div>
                  <div><dt>Mass</dt><dd>{numberLabel(planet.massEarth, " M⊕")}</dd></div>
                  <div><dt>Orbital period</dt><dd>{numberLabel(planet.orbitalPeriodDays, " days")}</dd></div>
                  <div><dt>Distance</dt><dd>{numberLabel(planet.distanceParsecs, " pc")}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">These are archive-reported measurements, not artist impressions or estimates made by this website. Values may be absent or revised as source literature changes. Open the original record for references and qualifications.</p>
          <a className="oo-observatory-text-link" href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">Open NASA Exoplanet Archive ↗</a>
        </section>
      )}

      {tab === "papers" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-papers-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">ARXIV · RESEARCH DISCOVERY</span><h2 id="oo-papers-title">Follow the research.</h2></div>
            <span className="oo-observatory-source-mark">PREPRINTS</span>
          </div>
          <form className="oo-observatory-filters" onSubmit={submitPaperSearch}>
            <label>Research keywords<input value={paperQueryDraft} onChange={(event) => setPaperQueryDraft(event.target.value)} maxLength={100} placeholder="e.g. gravitational waves" /></label>
            <label>Research area<select value={paperCategoryDraft} onChange={(event) => setPaperCategoryDraft(event.target.value)}><option value="astrophysics">Astrophysics</option><option value="cosmology">Cosmology</option><option value="exoplanets">Exoplanets</option><option value="solar">Solar physics</option><option value="space">Space physics</option><option value="relativity">General relativity</option><option value="all">All arXiv categories</option></select></label>
            <button type="submit">Search arXiv ↗</button>
          </form>
          {!loading && <p className="oo-observatory-results-count">Showing {papers.length} of {paperTotal.toLocaleString()} matching records. Search results are preprints unless an independent publication reference is listed.</p>}
          <div className="oo-paper-list">
            {papers.map((paper) => (
              <article className="oo-paper-card" key={paper.id}>
                <div className="oo-paper-meta"><span>arXiv:{paper.id}</span><time>{dateLabel(paper.submittedAt)}</time><span>PREPRINT</span></div>
                <h3><a href={paper.url} target="_blank" rel="noreferrer">{paper.title}</a></h3>
                <p className="oo-paper-authors">{paper.authors.join(", ") || "Authors not listed"}</p>
                <p>{paper.abstract}</p>
                <div className="oo-paper-categories">{paper.categories.map((category) => <span key={category}>{category}</span>)}</div>
                {paper.journalReference && <p className="oo-observatory-note">arXiv lists a journal reference: {paper.journalReference}</p>}
                {paper.doi && <p className="oo-observatory-note">DOI supplied by arXiv: <a href={"https://doi.org/" + paper.doi} target="_blank" rel="noreferrer">{paper.doi}</a></p>}
                <button type="button" className="oo-observatory-secondary-button" onClick={() => lookupPublication(paper)} disabled={crossrefLoading === paper.id}>
                  {crossrefLoading === paper.id ? "Checking Crossref…" : "Check publication metadata"}
                </button>
                {crossrefByPaper[paper.id] && (
                  <div className="oo-crossref-results">
                    <strong>Crossref candidates — compare before citing</strong>
                    {crossrefByPaper[paper.id].candidates.length === 0
                      ? <p>No likely publication match was returned. The preprint remains valid to read at its arXiv source.</p>
                      : crossrefByPaper[paper.id].candidates.slice(0, 3).map((candidate) => (
                        <p key={candidate.doi}>
                          <span>{candidate.matchLabel} · {Math.round(candidate.titleSimilarity * 100)}%</span><br />
                          <a href={candidate.doiUrl} target="_blank" rel="noreferrer">{candidate.title}</a>
                          {candidate.journal ? " · " + candidate.journal : ""}
                          {candidate.publicationDate ? " · " + candidate.publicationDate : ""}
                        </p>
                      ))}
                    <small>{crossrefByPaper[paper.id].guidance}</small>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {retrievedAt && <p className="oo-observatory-last-updated">Data retrieved {new Date(retrievedAt).toLocaleString()} · Always consult the original provider for the latest record.</p>}
      <footer className="oo-observatory-integrity">
        <span className="oo-eyebrow">A NOTE ON SCIENTIFIC EVIDENCE</span>
        <p>ORBIT &amp; ORIGIN displays records supplied by external scientific services. A catalogue entry, candidate, model output or preprint is not automatically a confirmed discovery or a peer-reviewed result. Editorial interpretation remains subject to human review.</p>
      </footer>
    </section>
  );
}
