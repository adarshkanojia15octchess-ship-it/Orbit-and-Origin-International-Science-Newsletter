import { NextRequest, NextResponse } from "next/server";
import { fetchText } from "@/lib/science/http";
import { parseArxivFeed } from "@/lib/science/normalizers.mjs";
import { parseSyndicationFeed } from "@/lib/science/feed-parser.mjs";
import { waitForArxivSlot } from "@/lib/science/arxiv-throttle";

export const revalidate = 900;

type DepartmentKey = "tapestry-of-worlds" | "frontier-tech" | "universal-record";
type FeedSource = {
  id: string;
  name: string;
  type: "rss" | "arxiv";
  feedUrl: string;
  homeUrl: string;
  allowedHosts: string[];
  recordType: string;
  searchQuery?: string;
  includePattern?: RegExp;
};

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

const DEPARTMENTS: Record<DepartmentKey, {
  title: string;
  intro: string;
  coverage: string[];
  sources: FeedSource[];
}> = {
  "tapestry-of-worlds": {
    title: "Tapestry of Worlds",
    intro: "Astronomy, astrophysics, cosmology, planetary science and space exploration — from the Solar System to the most distant galaxies.",
    coverage: ["Astronomy & observing", "Stars, galaxies & black holes", "Cosmology & fundamental physics", "Planetary science & exploration"],
    sources: [
      {
        id: "nasa-science", name: "NASA Science", type: "rss",
        feedUrl: "https://science.nasa.gov/feed/", homeUrl: "https://science.nasa.gov/",
        allowedHosts: ["nasa.gov"], recordType: "Institutional science update",
      },
      {
        id: "esa-news", name: "European Space Agency", type: "rss",
        feedUrl: "https://www.esa.int/rssfeed/TopNews", homeUrl: "https://www.esa.int/",
        allowedHosts: ["esa.int"], recordType: "Agency news release",
      },
      {
        id: "jpl-news", name: "NASA Jet Propulsion Laboratory", type: "rss",
        feedUrl: "https://www.jpl.nasa.gov/feeds/news/", homeUrl: "https://www.jpl.nasa.gov/",
        allowedHosts: ["jpl.nasa.gov"], recordType: "Research and mission news",
      },
      {
        id: "arxiv-astrophysics", name: "arXiv · Astrophysics", type: "arxiv",
        feedUrl: "https://export.arxiv.org/api/query", homeUrl: "https://arxiv.org/list/astro-ph/recent",
        allowedHosts: ["arxiv.org"], recordType: "Research preprint",
        searchQuery: "cat:astro-ph.*",
      },
    ],
  },
  "frontier-tech": {
    title: "Frontier Tech",
    intro: "Engineering, spaceflight, advanced materials, robotics, scientific instruments, computing and emerging technologies — with attention to what is demonstrated and what remains experimental.",
    coverage: ["Spaceflight & aerospace", "Robotics & scientific instruments", "Computing, AI & simulation", "Materials & engineering"],
    sources: [
      {
        id: "nasa-technology", name: "NASA Technology", type: "rss",
        feedUrl: "https://www.nasa.gov/technology/feed/", homeUrl: "https://www.nasa.gov/technology/",
        allowedHosts: ["nasa.gov"], recordType: "Technology news",
      },
      {
        id: "nasa-aeronautics", name: "NASA Aeronautics", type: "rss",
        feedUrl: "https://www.nasa.gov/aeronautics/feed/", homeUrl: "https://www.nasa.gov/aeronautics/",
        allowedHosts: ["nasa.gov"], recordType: "Aeronautics research update",
      },
      {
        id: "nsf-technology", name: "U.S. National Science Foundation", type: "rss",
        feedUrl: "https://www.nsf.gov/rss/rss_www_news.xml", homeUrl: "https://www.nsf.gov/",
        allowedHosts: ["nsf.gov", "govdelivery.com"], recordType: "Research and innovation announcement",
        includePattern: /\b(engineer(?:ing)?|technology|robot(?:ic|ics)?|artificial intelligence|\bAI\b|quantum|material(?:s)?|comput(?:er|ing)|semiconductor|chip|instrument|satellite|aerospace|manufactur(?:e|ing)|propulsion|sensor|laser|software)\b/i,
      },
      {
        id: "arxiv-frontier", name: "arXiv · Computing & Systems", type: "arxiv",
        feedUrl: "https://export.arxiv.org/api/query", homeUrl: "https://arxiv.org/",
        allowedHosts: ["arxiv.org"], recordType: "Research preprint",
        searchQuery: "cat:cs.AI OR cat:cs.RO OR cat:eess.SY OR cat:cs.CV OR cat:cs.ET",
      },
    ],
  },
  "universal-record": {
    title: "The Universal Record",
    intro: "A cross-disciplinary record of discoveries, scientific milestones and research developments across the physical, life, mathematical and computational sciences.",
    coverage: ["Research announcements", "Cross-disciplinary discoveries", "Scientific milestones & history", "Preprints and emerging results"],
    sources: [
      {
        id: "nsf-research", name: "U.S. National Science Foundation", type: "rss",
        feedUrl: "https://www.nsf.gov/rss/rss_www_news.xml", homeUrl: "https://www.nsf.gov/",
        allowedHosts: ["nsf.gov", "govdelivery.com"], recordType: "Research announcement",
      },
      {
        id: "nasa-news", name: "NASA News Releases", type: "rss",
        feedUrl: "https://www.nasa.gov/news-release/feed/", homeUrl: "https://www.nasa.gov/news/",
        allowedHosts: ["nasa.gov"], recordType: "Agency news release",
      },
      {
        id: "arxiv-cross-disciplinary", name: "arXiv · Cross-disciplinary research", type: "arxiv",
        feedUrl: "https://export.arxiv.org/api/query", homeUrl: "https://arxiv.org/",
        allowedHosts: ["arxiv.org"], recordType: "Research preprint",
        searchQuery: "cat:physics.* OR cat:math.* OR cat:q-bio.* OR cat:stat.* OR cat:q-fin.*",
      },
    ],
  },
};

function arxivUrl(source: FeedSource) {
  const url = new URL(source.feedUrl);
  url.searchParams.set("search_query", source.searchQuery || "cat:astro-ph.*");
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", "12");
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");
  return url.toString();
}

async function fetchSource(source: FeedSource): Promise<{
  items: DeskItem[];
  status: "available" | "unavailable";
  error?: string;
}> {
  try {
    if (source.type === "arxiv") {
      await waitForArxivSlot();
      const xml = await fetchText(arxivUrl(source), 900, {
        "User-Agent": "ORBIT-AND-ORIGIN-Department-Knowledge-Desk/1.0",
      });
      const parsed = parseArxivFeed(xml);
      const items = parsed.papers.map((paper) => {
        const submittedTime = paper.submittedAt ? Date.parse(paper.submittedAt) : Number.NaN;
        return {
          id: source.id + ":" + paper.id,
          title: paper.title,
          summary: paper.abstract.slice(0, 620),
          url: paper.url,
          publishedAt: Number.isFinite(submittedTime) ? new Date(submittedTime).toISOString() : null,
          sourceId: source.id,
          sourceName: source.name,
          recordType: source.recordType,
          categories: paper.categories.slice(0, 6),
        };
      });
      return { items, status: "available" };
    }

    const xml = await fetchText(source.feedUrl, 900, {
      "User-Agent": "ORBIT-AND-ORIGIN-Department-Knowledge-Desk/1.0",
    });
    let items = parseSyndicationFeed(xml, {
      sourceId: source.id,
      sourceName: source.name,
      recordType: source.recordType,
      allowedHosts: source.allowedHosts,
    });
    if (source.includePattern) {
      items = items.filter((item) => source.includePattern?.test(item.title + " " + item.summary));
    }
    return { items, status: "available" };
  } catch (error) {
    console.error(
      "[department-knowledge-desk:" + source.id + "]",
      error instanceof Error ? error.message : "Unknown feed error",
    );
    return {
      items: [],
      status: "unavailable",
      error: "This source is temporarily unavailable.",
    };
  }
}

function matchesQuery(item: DeskItem, query: string) {
  if (!query) return true;
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    item.title, item.summary, item.sourceName, item.recordType, ...item.categories,
  ].join(" ").toLocaleLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawDepartment = params.get("department") || "";
  if (!Object.prototype.hasOwnProperty.call(DEPARTMENTS, rawDepartment)) {
    return NextResponse.json(
      { error: "Choose one of the three ORBIT & ORIGIN departments." },
      { status: 400 },
    );
  }
  const department = DEPARTMENTS[rawDepartment as DepartmentKey];
  const query = (params.get("q") || "").trim().slice(0, 100);

  const results = await Promise.all(department.sources.map(async (source) => ({
    source,
    result: await fetchSource(source),
  })));

  const available = results.filter(({ result }) => result.status === "available").length;
  const sourceStatuses = results.map(({ source, result }) => ({
    id: source.id,
    name: source.name,
    type: source.type,
    recordType: source.recordType,
    homeUrl: source.homeUrl,
    feedUrl: source.feedUrl,
    status: result.status,
    count: result.items.length,
    error: result.error || null,
  }));

  if (available === 0) {
    return NextResponse.json({
      error: "The department sources are temporarily unavailable. Please try again shortly.",
      department: rawDepartment,
      title: department.title,
      intro: department.intro,
      coverage: department.coverage,
      items: [],
      sources: sourceStatuses,
      partial: false,
      retrievedAt: new Date().toISOString(),
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const items = results.flatMap(({ result }) => result.items)
    .filter((item) => matchesQuery(item, query))
    .sort((left, right) => {
      const a = left.publishedAt ? Date.parse(left.publishedAt) : 0;
      const b = right.publishedAt ? Date.parse(right.publishedAt) : 0;
      return b - a;
    });
  const unique = Array.from(new Map(items.map((item) => [item.url, item])).values());

  return NextResponse.json({
    department: rawDepartment,
    title: department.title,
    intro: department.intro,
    coverage: department.coverage,
    query,
    items: unique.slice(0, 36),
    total: unique.length,
    sources: sourceStatuses,
    partial: available !== results.length,
    retrievedAt: new Date().toISOString(),
    refreshIntervalMinutes: 15,
    editorialNote: "This desk aggregates source-published updates. Institutional announcements are not automatically independent peer review, and arXiv entries are preprints unless a separate journal publication is verified. ORBIT & ORIGIN has not independently endorsed each source item.",
  });
}
