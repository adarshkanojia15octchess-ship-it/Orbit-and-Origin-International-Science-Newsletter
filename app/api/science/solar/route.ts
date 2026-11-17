import { NextRequest, NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { normalizeSolarEvents } from "@/lib/science/normalizers.mjs";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const rawDays = request.nextUrl.searchParams.get("days") || "7";
  const days = Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return NextResponse.json({ error: "Choose a period between 1 and 30 days." }, { status: 400 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";

  const buildUrl = (kind: "CME" | "FLR") => {
    const url = new URL("https://api.nasa.gov/DONKI/" + kind);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("api_key", apiKey);
    return url.toString();
  };

  try {
    const [cmeResult, flareResult] = await Promise.allSettled([
      fetchJson(buildUrl("CME"), 600),
      fetchJson(buildUrl("FLR"), 600),
    ]);
    const cmes = cmeResult.status === "fulfilled" ? cmeResult.value : [];
    const flares = flareResult.status === "fulfilled" ? flareResult.value : [];
    if (cmeResult.status === "rejected" && flareResult.status === "rejected") {
      throw new Error("NASA DONKI endpoints were both unavailable.");
    }
    const events = normalizeSolarEvents(cmes, flares);
    return NextResponse.json({
      events,
      period: { startDate, endDate, days },
      partial: cmeResult.status === "rejected" || flareResult.status === "rejected",
      source: "NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI)",
      sourceUrl: "https://api.nasa.gov/",
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    return providerFailure("NASA DONKI", error);
  }
}
