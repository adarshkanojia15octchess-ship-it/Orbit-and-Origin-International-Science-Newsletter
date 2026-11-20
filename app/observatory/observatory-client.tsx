"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type Tab = "cosmic" | "solar" | "exoplanets" | "papers" | "gaia" | "euclid" | "earth";
type CosmicMediaItem = {
  nasaId: string; title: string; description: string; dateCreated: string | null;
  mediaType: string; center: string | null; photographer: string | null;
  secondaryCreator: string | null; location: string | null; keywords: string[];
  copyright: string | null; imageUrl: string | null; sourceUrl: string;
};
type CosmicMediaResponse = {
  query: string; mediaType: string; page: number; items: CosmicMediaItem[];
  featured: CosmicMediaItem | null; total: number; source: string;
  sourceUrl: string; retrievedAt: string;
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
type CloseApproach = { designation: string; dateTime: string; distanceAu: number | null; minimumDistanceAu: number | null; relativeVelocityKmS: number | null; absoluteMagnitude: number | null; diameterKm: number | null };
type GaiaStar = { sourceId: string; designation: string | null; raDeg: number | null; decDeg: number | null; parallaxMas: number | null; parallaxErrorMas: number | null; parallaxSignalToNoise: number | null; properMotionRaMasYr: number | null; properMotionDecMasYr: number | null; gMagnitude: number | null; distancePc: number | null };
type EuclidObservation = { id: string; collection: string | null; productType: string | null; calibrationLevel: number | null; targetName: string | null; raDeg: number | null; decDeg: number | null; observationMjd: number | null; accessFormat: string | null };
type EarthquakeEvent = { id: string; title: string | null; place: string | null; magnitude: number | null; magnitudeType: string | null; time: number | null; depthKm: number | null; longitude: number | null; latitude: number | null; felt: number | null; tsunami: boolean; significance: number | null; eventUrl: string };

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
  const [tab, setTab] = useState<Tab>("cosmic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrievedAt, setRetrievedAt] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((current) => current + 1);
      }
    };
    const interval = window.setInterval(refreshWhenVisible, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const [cosmicMedia, setCosmicMedia] = useState<CosmicMediaResponse | null>(null);
  const [mediaSearchDraft, setMediaSearchDraft] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [solarEvents, setSolarEvents] = useState<SolarEvent[]>([]);
  const [solarPartial, setSolarPartial] = useState(false);
  const [closeApproaches, setCloseApproaches] = useState<CloseApproach[]>([]);
  const [gaiaStars, setGaiaStars] = useState<GaiaStar[]>([]);
  const [euclidObservations, setEuclidObservations] = useState<EuclidObservation[]>([]);
  const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
  const [earthquakeTotal, setEarthquakeTotal] = useState(0);
  const [earthquakePeriod, setEarthquakePeriod] = useState("week");
  const [earthquakeMagnitude, setEarthquakeMagnitude] = useState("4.5");
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
    if (tab !== "cosmic") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ media_type: mediaType });
    if (mediaQuery) params.set("q", mediaQuery);
    readApi<CosmicMediaResponse>("/api/science/nasa-media?" + params.toString(), controller.signal)
      .then((result) => {
        setCosmicMedia(result);
        setRetrievedAt(result.retrievedAt);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "NASA's media archive is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, refreshKey, mediaQuery, mediaType]);

  useEffect(() => {
    if (tab !== "solar") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.allSettled([
      readApi<{ events: SolarEvent[]; partial: boolean; retrievedAt: string }>("/api/science/solar?days=7", controller.signal),
      readApi<{ approaches: CloseApproach[]; retrievedAt: string }>("/api/science/approaches", controller.signal),
    ]).then(([solarResult, approachResult]) => {
      if (solarResult.status === "rejected" && approachResult.status === "rejected") throw solarResult.reason;
      setSolarEvents(solarResult.status === "fulfilled" ? solarResult.value.events : []);
      setCloseApproaches(approachResult.status === "fulfilled" ? approachResult.value.approaches : []);
      setSolarPartial(solarResult.status === "rejected" || approachResult.status === "rejected" ||
        (solarResult.status === "fulfilled" && solarResult.value.partial));
      const timestamps = [
        solarResult.status === "fulfilled" ? solarResult.value.retrievedAt : "",
        approachResult.status === "fulfilled" ? approachResult.value.retrievedAt : "",
      ].filter(Boolean).sort();
      if (timestamps.length) setRetrievedAt(timestamps[timestamps.length - 1]);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Space-weather and close-approach data are unavailable.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
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
  }, [tab, planetQuery, planetMethod, refreshKey]);

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
  }, [tab, paperQuery, paperCategory, refreshKey]);

  useEffect(() => {
    if (tab !== "gaia") return;
    const controller = new AbortController();
    setLoading(true); setError("");
    readApi<{ stars: GaiaStar[]; retrievedAt: string }>("/api/science/gaia", controller.signal)
      .then((result) => { setGaiaStars(result.stars); setRetrievedAt(result.retrievedAt); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The Gaia Archive is unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab]);

  useEffect(() => {
    if (tab !== "euclid") return;
    const controller = new AbortController();
    setLoading(true); setError("");
    readApi<{ observations: EuclidObservation[]; retrievedAt: string }>("/api/science/euclid", controller.signal)
      .then((result) => { setEuclidObservations(result.observations); setRetrievedAt(result.retrievedAt); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The Euclid Science Archive is unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab]);

  useEffect(() => {
    if (tab !== "earth") return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ period: earthquakePeriod, magnitude: earthquakeMagnitude });
    readApi<{ events: EarthquakeEvent[]; total: number; retrievedAt: string }>("/api/science/earthquakes?" + params.toString(), controller.signal)
      .then((result) => { setEarthquakes(result.events); setEarthquakeTotal(result.total); setRetrievedAt(result.retrievedAt); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The USGS earthquake feed is unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, earthquakePeriod, earthquakeMagnitude, refreshKey]);

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
        <button type="button" role="tab" aria-selected={tab === "cosmic"} className={tab === "cosmic" ? "is-active" : ""} onClick={() => setTab("cosmic")}>Cosmic Frame</button>
        <button type="button" role="tab" aria-selected={tab === "solar"} className={tab === "solar" ? "is-active" : ""} onClick={() => setTab("solar")}>Solar activity</button>
        <button type="button" role="tab" aria-selected={tab === "exoplanets"} className={tab === "exoplanets" ? "is-active" : ""} onClick={() => setTab("exoplanets")}>Exoplanet Atlas</button>
        <button type="button" role="tab" aria-selected={tab === "papers"} className={tab === "papers" ? "is-active" : ""} onClick={() => setTab("papers")}>Research Radar</button>
        <button type="button" role="tab" aria-selected={tab === "gaia"} className={tab === "gaia" ? "is-active" : ""} onClick={() => setTab("gaia")}>Gaia · Stars</button>
        <button type="button" role="tab" aria-selected={tab === "euclid"} className={tab === "euclid" ? "is-active" : ""} onClick={() => setTab("euclid")}>Euclid Deep Sky</button>
        <button type="button" role="tab" aria-selected={tab === "earth"} className={tab === "earth" ? "is-active" : ""} onClick={() => setTab("earth")}>Earth Monitor</button>
      </div>

      <div className="oo-observatory-refresh-row">
        <p className="oo-observatory-note">Automatic check every 15 minutes while this page is open; returning to this tab also checks again. Provider cache windows vary by source.</p>
        <button type="button" className="oo-observatory-secondary-button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading}>
          {loading ? "Checking…" : "↻ Check for updates"}
        </button>
      </div>
      {loading && <p className="oo-observatory-status" role="status">Checking the latest available records from the scientific providers…</p>}
      {error && <p className="oo-observatory-error" role="alert">{error}</p>}

      {tab === "cosmic" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-cosmic-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">ORBIT &amp; ORIGIN · NASA MEDIA LIBRARY</span><h2 id="oo-cosmic-title">The Cosmic Frame.</h2></div>
            <span className="oo-observatory-source-mark">AUTOMATED DAILY PICK</span>
          </div>
          <p className="oo-cosmic-intro">A daily window into NASA’s image, video and audio archive. An archive item is selected automatically each day; it is a discovery prompt, not a human-reviewed editorial recommendation. Explore the original record, its metadata and the people and missions behind it.</p>
          {cosmicMedia?.featured && (
            <article className="oo-cosmic-feature">
              <div className="oo-cosmic-feature-art">
                {cosmicMedia.featured.imageUrl ? (
                  <Image src={cosmicMedia.featured.imageUrl} alt={cosmicMedia.featured.title} width={1600} height={1100} sizes="(max-width: 900px) 100vw, 65vw" />
                ) : <div className="oo-observatory-placeholder"><span>{cosmicMedia.featured.mediaType.toUpperCase()} PREVIEW</span><p>A preview is not available here. Open the original NASA record to view or listen to this item.</p></div>}
              </div>
              <div className="oo-cosmic-feature-copy">
                <p className="oo-observatory-date">TODAY’S COSMIC FRAME · AUTOMATED ARCHIVE SELECTION · {dateLabel(cosmicMedia.featured.dateCreated)}</p>
                <h3>{cosmicMedia.featured.title}</h3>
                <p>{cosmicMedia.featured.description || "NASA’s archive record does not include a description."}</p>
                {cosmicMedia.featured.center && <p className="oo-observatory-credit">NASA centre · {cosmicMedia.featured.center}</p>}
                {cosmicMedia.featured.photographer && <p className="oo-observatory-credit">Photographer · {cosmicMedia.featured.photographer}</p>}
                {cosmicMedia.featured.secondaryCreator && <p className="oo-observatory-credit">Additional credit · {cosmicMedia.featured.secondaryCreator}</p>}
                {cosmicMedia.featured.copyright && <p className="oo-observatory-credit">Copyright notice · {cosmicMedia.featured.copyright}</p>}
                <a className="oo-observatory-text-link" href={cosmicMedia.featured.sourceUrl} target="_blank" rel="noreferrer">Open original NASA media record ↗</a>
              </div>
            </article>
          )}
          <form className="oo-observatory-filters oo-cosmic-search" onSubmit={(event) => { event.preventDefault(); setMediaQuery(mediaSearchDraft.trim()); }}>
            <label>Search NASA’s archive<input value={mediaSearchDraft} onChange={(event) => setMediaSearchDraft(event.target.value)} maxLength={100} placeholder="e.g. Voyager 1, nebula, Saturn, Apollo 11" /></label>
            <label>Media type<select value={mediaType} onChange={(event) => setMediaType(event.target.value)}><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option></select></label>
            <button type="submit">Search archive ↗</button>
          </form>
          {cosmicMedia && <p className="oo-observatory-results-count">Showing {cosmicMedia.items.length} records from {cosmicMedia.total.toLocaleString()} NASA archive results for “{cosmicMedia.query}”.</p>}
          <div className="oo-cosmic-grid">
            {cosmicMedia?.items.filter((item) => item.nasaId !== cosmicMedia.featured?.nasaId).slice(0, 12).map((item) => (
              <article className="oo-cosmic-card" key={item.nasaId}>
                {item.imageUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={"Open NASA record: " + item.title}><Image src={item.imageUrl} alt={item.title} width={640} height={480} sizes="(max-width: 700px) 100vw, 33vw" /></a> : <div className="oo-cosmic-card-placeholder">{item.mediaType.toUpperCase()} · OPEN RECORD</div>}
                <div className="oo-cosmic-card-copy">
                  <span className="oo-eyebrow">{item.center || "NASA ARCHIVE"} · {dateLabel(item.dateCreated)}</span>
                  <h3><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.title}</a></h3>
                  {item.photographer && <p>Credit: {item.photographer}</p>}
                </div>
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">Cosmic Frame is an independent ORBIT &amp; ORIGIN discovery feature using NASA’s searchable media archive; it is not an official NASA APOD publication. The daily item is selected automatically and has not necessarily been reviewed by an editor. Treat it as a starting point for exploration, not as an editorial endorsement. Before republishing any item in a newsletter, inspect its original record, verify the credit and rights information, and check for third-party copyright restrictions. Video and audio entries link to their NASA records; an embedded playable preview is not guaranteed.</p>
          <a className="oo-observatory-text-link" href="https://images.nasa.gov/" target="_blank" rel="noreferrer">Explore the complete NASA Image and Video Library ↗</a>
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
          <div className="oo-observatory-panel-heading oo-subpanel-heading">
            <div><span className="oo-eyebrow">NASA/JPL · NEXT 60 DAYS</span><h2>Asteroids approaching Earth.</h2></div>
            <span className="oo-observatory-source-mark">CLOSE APPROACHES</span>
          </div>
          {!loading && !closeApproaches.length && !error && <p className="oo-observatory-note">No records met this panel’s current date and distance filters. Open JPL’s source page to explore other query ranges.</p>}
          <div className="oo-observatory-event-list">
            {closeApproaches.map((approach) => (
              <article className="oo-observatory-event" key={approach.designation + approach.dateTime}>
                <div className="oo-observatory-event-top"><span>Earth close approach</span><time>{approach.dateTime}</time></div>
                <h3>{approach.designation}</h3>
                <p>Nominal distance · {numberLabel(approach.distanceAu, " au")}<br />
                  Relative velocity · {numberLabel(approach.relativeVelocityKmS, " km/s")}<br />
                  Estimated diameter · {numberLabel(approach.diameterKm, " km")}
                </p>
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">This panel is limited to records within 0.05 au over the next 60 days. A close approach is not a prediction of impact; uncertainty bounds and orbital solutions matter.</p>
          <a className="oo-observatory-text-link" href="https://ssd-api.jpl.nasa.gov/doc/cad.html" target="_blank" rel="noreferrer">Read JPL’s API documentation ↗</a>
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

      {tab === "gaia" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-gaia-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">ESA GAIA · DATA RELEASE 3</span><h2 id="oo-gaia-title">A census of nearby stars.</h2></div>
            <span className="oo-observatory-source-mark">ASTROMETRY</span>
          </div>
          <p className="oo-observatory-results-count">A live TAP query selects positive parallaxes above 50 mas with parallax signal-to-noise of at least 10. {gaiaStars.length} stellar records returned.</p>
          <div className="oo-planet-grid">
            {gaiaStars.map((star) => (
              <article className="oo-planet-card" key={star.sourceId}>
                <span className="oo-eyebrow">GAIA DR3 · {star.sourceId}</span>
                <h3>{star.designation || "Gaia source"}</h3>
                <p className="oo-planet-host">ICRS · {numberLabel(star.raDeg, "°")} RA · {numberLabel(star.decDeg, "°")} Dec</p>
                <dl>
                  <div><dt>Parallax</dt><dd>{numberLabel(star.parallaxMas, " mas")}</dd></div>
                  <div><dt>Inverse-parallax distance</dt><dd>{numberLabel(star.distancePc, " pc")}</dd></div>
                  <div><dt>G magnitude</dt><dd>{numberLabel(star.gMagnitude)}</dd></div>
                  <div><dt>Parallax S/N</dt><dd>{numberLabel(star.parallaxSignalToNoise)}</dd></div>
                  <div><dt>Proper motion RA</dt><dd>{numberLabel(star.properMotionRaMasYr, " mas/yr")}</dd></div>
                  <div><dt>Proper motion Dec</dt><dd>{numberLabel(star.properMotionDecMasYr, " mas/yr")}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">Distances are the simple inverse of positive parallax, not Bayesian distance estimates. Gaia astrometry has uncertainties and selection effects; this is an educational view, not a precision distance catalogue.</p>
          <a className="oo-observatory-text-link" href="https://gea.esac.esa.int/archive/" target="_blank" rel="noreferrer">Open the ESA Gaia Archive ↗</a>
        </section>
      )}

      {tab === "euclid" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-euclid-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">ESA EUCLID · PUBLIC SCIENCE ARCHIVE</span><h2 id="oo-euclid-title">Surveying the dark Universe.</h2></div>
            <span className="oo-observatory-source-mark">DEEP SKY</span>
          </div>
          <p className="oo-observatory-results-count">{euclidObservations.length} public observation-metadata records returned from the archive’s standard ObsCore table.</p>
          <div className="oo-observatory-event-list">
            {euclidObservations.map((observation) => (
              <article className="oo-observatory-event" key={observation.id}>
                <div className="oo-observatory-event-top"><span>{observation.productType || "Data product"}</span><time>Calibration level {observation.calibrationLevel ?? "not reported"}</time></div>
                <h3>{observation.targetName || observation.id}</h3>
                <p>Observation ID · {observation.id}<br />
                  Collection · {observation.collection || "Not supplied"}<br />
                  Sky position · {numberLabel(observation.raDeg, "°")} RA · {numberLabel(observation.decDeg, "°")} Dec<br />
                  Time (MJD) · {numberLabel(observation.observationMjd)}<br />
                  Format · {observation.accessFormat || "Not supplied"}
                </p>
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">This is archive metadata, not an image or a scientific result. Euclid Q1 is public; large data products and detailed catalogue queries should be opened in the original archive.</p>
          <a className="oo-observatory-text-link" href="https://eas.esac.esa.int/sas/" target="_blank" rel="noreferrer">Explore the ESA Euclid Science Archive ↗</a>
        </section>
      )}

      {tab === "earth" && (
        <section className="oo-observatory-panel" role="tabpanel" aria-labelledby="oo-earth-title">
          <div className="oo-observatory-panel-heading">
            <div><span className="oo-eyebrow">NASA GIBS + USGS · EARTH OBSERVATIONS</span><h2 id="oo-earth-title">Our changing planet.</h2></div>
            <span className="oo-observatory-source-mark">EARTH SYSTEM</span>
          </div>
          <div className="oo-earth-image-card">
            <Image src={"/api/science/earth-imagery?refresh=" + refreshKey} alt="Global true-colour satellite imagery from NASA MODIS Terra, served by NASA GIBS." width={1536} height={768} sizes="(max-width: 900px) 100vw, 80vw" />
            <p>NASA Global Imagery Browse Services · MODIS Terra corrected reflectance, true colour. The latest available composite may lag the current date.</p>
          </div>
          <div className="oo-observatory-panel-heading oo-subpanel-heading">
            <div><span className="oo-eyebrow">USGS · COMCAT GEOJSON FEED</span><h2>Recent earthquakes.</h2></div>
            <span className="oo-observatory-source-mark">SEISMIC EVENTS</span>
          </div>
          <div className="oo-observatory-filters oo-earth-filters">
            <label>Time window<select value={earthquakePeriod} onChange={(event) => setEarthquakePeriod(event.target.value)}><option value="hour">Past hour</option><option value="day">Past day</option><option value="week">Past 7 days</option></select></label>
            <label>Magnitude feed<select value={earthquakeMagnitude} onChange={(event) => setEarthquakeMagnitude(event.target.value)}><option value="significant">Significant</option><option value="4.5">M4.5+</option><option value="2.5">M2.5+</option><option value="1.0">M1.0+</option><option value="all">All reported events</option></select></label>
          </div>
          <p className="oo-observatory-results-count">Showing {earthquakes.length} records from a feed containing {earthquakeTotal.toLocaleString()} matching events.</p>
          <div className="oo-observatory-event-list">
            {earthquakes.map((event) => (
              <article className="oo-observatory-event" key={event.id}>
                <div className="oo-observatory-event-top"><span>{event.magnitudeType || "Magnitude"} · {numberLabel(event.magnitude)}</span><time>{event.time ? new Date(event.time).toLocaleString() : "Time unavailable"}</time></div>
                <h3>{event.place || event.title || "Earthquake event"}</h3>
                <p>Depth · {numberLabel(event.depthKm, " km")}<br />
                  Coordinates · {numberLabel(event.latitude, "°")} lat · {numberLabel(event.longitude, "°")} lon<br />
                  {event.felt !== null ? "Felt reports · " + event.felt : "Felt reports · Not supplied"}
                  {event.tsunami ? " · Tsunami flag in source record" : ""}
                </p>
                <a className="oo-observatory-text-link" href={event.eventUrl} target="_blank" rel="noreferrer">USGS event details ↗</a>
              </article>
            ))}
          </div>
          <p className="oo-observatory-note">USGS event parameters may be revised as analysis continues. This global feed is not a local alert or personal safety assessment.</p>
          <a className="oo-observatory-text-link" href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noreferrer">USGS feed documentation ↗</a>
        </section>
      )}

      {retrievedAt && <p className="oo-observatory-last-updated">Checked by ORBIT &amp; ORIGIN: {new Date(retrievedAt).toLocaleString()} · This is the check time, not necessarily the scientific observation or catalogue release date. Consult the provider for its record-level timestamps.</p>}
      <footer className="oo-observatory-integrity">
        <span className="oo-eyebrow">A NOTE ON SCIENTIFIC EVIDENCE</span>
        <p>ORBIT &amp; ORIGIN displays records supplied by external scientific services. A catalogue entry, candidate, model output or preprint is not automatically a confirmed discovery or a peer-reviewed result. Editorial interpretation remains subject to human review.</p>
      </footer>
    </section>
  );
}
