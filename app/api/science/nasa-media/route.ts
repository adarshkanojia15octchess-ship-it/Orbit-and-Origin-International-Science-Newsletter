import { NextRequest, NextResponse } from "next/server";
import { fetchJson, providerFailure, safeExternalUrl, stripMarkup } from "@/lib/science/http";

export const revalidate = 86400;

type NasaMediaRecord = {
  nasa_id?: string;
  title?: string;
  description?: string;
  date_created?: string;
  media_type?: string;
  center?: string;
  photographer?: string;
  secondary_creator?: string;
  location?: string;
  keywords?: string[];
  copyright?: string;
};
type NasaMediaItem = {
  data?: NasaMediaRecord[];
  links?: Array<{ href?: string; rel?: string; render?: string }>;
};
type NasaSearchResponse = {
  collection?: {
    items?: NasaMediaItem[];
    metadata?: { total_hits?: number };
  };
};

function normalize(item: NasaMediaItem) {
  const data = item.data?.[0];
  if (!data?.nasa_id || !data.title) return null;
  const preview = safeExternalUrl(
    item.links?.find((link) => link.rel === "preview" && link.render === "image")?.href,
    ["images-assets.nasa.gov"],
  );
  if (data.media_type === "image" && !preview) return null;
  return {
    nasaId: data.nasa_id,
    title: stripMarkup(data.title),
    description: stripMarkup(data.description),
    dateCreated: data.date_created || null,
    mediaType: data.media_type || "image",
    center: data.center || null,
    photographer: data.photographer || null,
    secondaryCreator: data.secondary_creator || null,
    location: data.location || null,
    keywords: (data.keywords || []).slice(0, 8),
    copyright: data.copyright || null,
    imageUrl: preview,
    sourceUrl: "https://images.nasa.gov/details/" + encodeURIComponent(data.nasa_id),
  };
}

const DAILY_TOPICS = [
  "galaxy", "nebula", "planet", "Moon", "star cluster", "Saturn",
  "Mars", "Earth from space", "space telescope", "aurora", "deep field", "Jupiter",
];

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const rawType = request.nextUrl.searchParams.get("media_type") || "image";
  const mediaType = ["image", "video", "audio"].includes(rawType) ? rawType : "image";
  const rawPage = Number(request.nextUrl.searchParams.get("page") || "1");
  const page = Number.isInteger(rawPage) ? Math.min(100, Math.max(1, rawPage)) : 1;
  const dailyTopic = DAILY_TOPICS[Math.floor(Date.now() / 86400000) % DAILY_TOPICS.length];
  const searchTerm = query || dailyTopic;

  const url = new URL("https://images-api.nasa.gov/search");
  url.searchParams.set("q", searchTerm);
  url.searchParams.set("media_type", mediaType);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "50");

  try {
    const raw = await fetchJson(url.toString(), query ? 3600 : 86400) as NasaSearchResponse;
    const items = (raw.collection?.items || [])
      .map(normalize)
      .filter((item): item is NonNullable<ReturnType<typeof normalize>> => item !== null);
    if (!items.length) {
      return NextResponse.json({
        query: searchTerm, mediaType, page, isDaily: !query, items: [], featured: null,
        total: raw.collection?.metadata?.total_hits || 0,
        source: "NASA Image and Video Library",
        sourceUrl: "https://images.nasa.gov/",
        retrievedAt: new Date().toISOString(),
      });
    }

    const dayNumber = Math.floor(Date.now() / 86400000);
    const featured = query ? items[0] : items[dayNumber % items.length];
    return NextResponse.json({
      query: searchTerm,
      mediaType,
      page,
      isDaily: !query,
      items,
      featured,
      total: raw.collection?.metadata?.total_hits || items.length,
      source: "NASA Image and Video Library",
      sourceUrl: "https://images.nasa.gov/",
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    return providerFailure("NASA Image and Video Library", error);
  }
}
