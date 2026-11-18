import { NextRequest, NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { normalizeEarthquakeFeatures } from "@/lib/science/normalizers.mjs";

export const revalidate = 60;

const periods = ["hour", "day", "week"] as const;
const magnitudes = ["significant", "4.5", "2.5", "1.0", "all"] as const;
type Period = (typeof periods)[number];
type Magnitude = (typeof magnitudes)[number];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const period = (params.get("period") || "week") as Period;
  const magnitude = (params.get("magnitude") || "4.5") as Magnitude;
  if (!periods.includes(period) || !magnitudes.includes(magnitude)) {
    return NextResponse.json({
      error: "Choose a supported USGS feed period and magnitude threshold.",
    }, { status: 400 });
  }
  const sourceUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/" +
    magnitude + "_" + period + ".geojson";
  try {
    const raw = await fetchJson(sourceUrl, 60);
    if (!raw || typeof raw !== "object" ||
      !Array.isArray((raw as Record<string, unknown>).features)) {
      throw new Error("USGS returned an unexpected GeoJSON feed.");
    }
    const payload = raw as {
      features: unknown[];
      metadata?: { count?: number; title?: string; generated?: number };
    };
    const events = normalizeEarthquakeFeatures(payload.features).slice(0, 40);
    return NextResponse.json({
      events, count: events.length, total: payload.metadata?.count ?? events.length,
      period, magnitude,
      feedTitle: payload.metadata?.title ?? "USGS earthquake summary feed",
      source: "U.S. Geological Survey · Earthquake Hazards Program",
      sourceUrl,
      documentationUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
      generatedAt: payload.metadata?.generated
        ? new Date(payload.metadata.generated).toISOString() : null,
      retrievedAt: new Date().toISOString(),
      interpretationNote: "Magnitudes and event details are those reported by USGS and may be revised. This global summary feed is not a local alert or a personal safety assessment.",
    });
  } catch (error) {
    return providerFailure("USGS Earthquake Feed", error);
  }
}
