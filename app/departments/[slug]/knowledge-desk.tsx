"use client";

import { useEffect, useMemo, useState } from "react";

type DeskItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  sourceId: string;
  sourceName: string;
  recordType: string;
  categories: string[];
};

type DeskSource = {
  id: string;
  name: string;
  type: "rss" | "arxiv";
  recordType: string;
  homeUrl: string;
  feedUrl: string;
  status: "available" | "unavailable";
  count: number;
  error: string | null;
};

type DeskResponse = {
  department: string;
  title: string;
  intro: string;
  coverage: string[];
  items: DeskItem[];
  total: number;
  sources: DeskSource[];
  partial: boolean;
  retrievedAt: string;
  refreshIntervalMinutes: number;
  editorialNote: string;
  error?: string;
};

type Props = { department: string };

function localDate(value: string | null) {
  if (!value) return "Date not supplied by source";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not supplied by source";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function checkedTime(value: string | undefined) {
  if (!value) return "Not checked yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not checked yet"
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(date);
}

export default function DepartmentKnowledgeDesk({ department }: Props) {
  const [data, setData] = useState<DeskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefreshKey((current) => current + 1);
      }
    }, 15 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((current) => current + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ department });
    fetch("/api/department-knowledge-desk?" + params.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json() as DeskResponse;
        if (!response.ok) {
          throw new Error(payload.error || "The department sources could not be reached.");
        }
        return payload;
      })
      .then((payload) => setData(payload))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "The department sources could not be reached.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [department, refreshKey]);

  const visibleItems = useMemo(() => {
    const items = data?.items || [];
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (sourceFilter !== "all" && item.sourceId !== sourceFilter) return false;
      if (!terms.length) return true;
      const content = [
        item.title, item.summary, item.sourceName, item.recordType, ...item.categories,
      ].join(" ").toLocaleLowerCase();
      return terms.every((term) => content.includes(term));
    });
  }, [data, query, sourceFilter]);

  const availableSources = data?.sources.filter((source) => source.status === "available").length || 0;

  return (
    <section className="oo-knowledge-desk" aria-labelledby="oo-knowledge-desk-title">
      <header className="oo-knowledge-heading">
        <div>
          <span className="kicker">ORBIT &amp; ORIGIN · LIVE SOURCE MONITOR</span>
          <h2 id="oo-knowledge-desk-title">Department Knowledge Desk.</h2>
          <p className="oo-knowledge-intro">
            {data?.intro || "Recent research, institutional announcements and field developments from the sources listed below."}
          </p>
        </div>
        <div className="oo-knowledge-update">
          <span className="oo-knowledge-live-dot" aria-hidden="true" />
          <span>{loading && !data ? "Connecting to sources" : "Source monitor"}</span>
          <small>Checked · {checkedTime(data?.retrievedAt)}</small>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading}>
            {loading ? "Checking…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      {data?.coverage?.length ? (
        <div className="oo-knowledge-coverage" aria-label="Topics covered by this desk">
          {data.coverage.map((topic, index) => (
            <span key={topic}><small>0{index + 1}</small>{topic}</span>
          ))}
        </div>
      ) : null}

      <div className="oo-knowledge-sourcebar">
        <div className="oo-knowledge-source-summary">
          <strong>{data?.items.length ?? 0}</strong>
          <span>source records</span>
          <i aria-hidden="true">·</i>
          <strong>{availableSources}</strong>
          <span>of {data?.sources.length ?? 0} sources responding</span>
        </div>
        {data?.partial ? (
          <span className="oo-knowledge-partial">Some sources are temporarily unavailable</span>
        ) : (
          <span className="oo-knowledge-complete">Source checks complete</span>
        )}
      </div>

      {data?.sources?.length ? (
        <div className="oo-knowledge-providers" aria-label="Source availability">
          {data.sources.map((source) => (
            <a
              className={"oo-knowledge-provider" + (source.status === "unavailable" ? " is-unavailable" : "")}
              key={source.id}
              href={source.homeUrl}
              target="_blank"
              rel="noreferrer"
              title={source.status === "unavailable" ? "This provider did not respond; open its original site." : "Open the original source"}
            >
              <span className="oo-knowledge-provider-dot" aria-hidden="true" />
              <span>{source.name}</span>
              <small>{source.status === "available" ? "Connected" : "Unavailable"}</small>
            </a>
          ))}
        </div>
      ) : null}

      <div className="oo-knowledge-controls">
        <label>
          <span>Search this desk</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search discoveries, missions, materials…"
            maxLength={100}
          />
        </label>
        <label>
          <span>Source</span>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">All sources</option>
            {(data?.sources || []).map((source) => (
              <option key={source.id} value={source.id}>{source.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error && !data ? (
        <div className="oo-knowledge-empty" role="alert">
          <strong>The Knowledge Desk could not connect.</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Try again</button>
        </div>
      ) : loading && !data ? (
        <div className="oo-knowledge-empty" role="status">
          <strong>Gathering the latest source updates…</strong>
          <p>Checking institutional feeds and research records. Each source is contacted independently.</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="oo-knowledge-empty">
          <strong>{query || sourceFilter !== "all" ? "No matching updates." : "No updates were returned."}</strong>
          <p>
            {query || sourceFilter !== "all"
              ? "Try a broader search or another source."
              : "The connected sources did not return records for this check. Open a provider above to inspect its original publication stream."}
          </p>
        </div>
      ) : (
        <>
          <div className="oo-knowledge-grid">
            {visibleItems.map((item, index) => (
              <article className="oo-knowledge-card" key={item.id}>
                <div className="oo-knowledge-card-meta">
                  <span>{item.sourceName}</span>
                  <time dateTime={item.publishedAt || undefined}>{localDate(item.publishedAt)}</time>
                </div>
                <div className="oo-knowledge-card-body">
                  <span className="oo-knowledge-record-type">{item.recordType}</span>
                  <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a></h3>
                  {item.summary ? <p>{item.summary}</p> : <p>The original source has not supplied a summary. Open the record for the full report.</p>}
                </div>
                {item.categories.length > 0 && (
                  <div className="oo-knowledge-tags">
                    {item.categories.slice(0, 3).map((category) => <span key={category}>{category}</span>)}
                  </div>
                )}
                {item.recordType.toLowerCase().includes("preprint") && (
                  <p className="oo-knowledge-preprint-note">Preprint record · not automatically peer reviewed</p>
                )}
                <div className="oo-knowledge-card-foot">
                  <span>Original source</span>
                  <a href={item.url} target="_blank" rel="noreferrer">Read source ↗</a>
                </div>
                <span className="oo-knowledge-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              </article>
            ))}
          </div>
          <div className="oo-knowledge-results-note">
            Showing {visibleItems.length} of {data?.total ?? visibleItems.length} returned records. Publication dates are supplied by the publishers; the check time above is when this desk last retrieved the feeds.
          </div>
        </>
      )}

      <footer className="oo-knowledge-editorial-note">
        <span className="kicker">A NOTE ON EVIDENCE</span>
        <p>
          {data?.editorialNote || "These are links to source-published updates, not independent ORBIT & ORIGIN endorsements. Read the source material and its cited research before drawing conclusions."}
        </p>
      </footer>
    </section>
  );
}
