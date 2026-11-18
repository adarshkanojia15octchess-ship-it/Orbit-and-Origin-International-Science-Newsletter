import { NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { normalizeCloseApproaches } from "@/lib/science/normalizers.mjs";

export const revalidate = 3600;

export async function GET() {
  try {
    const url = new URL("https://ssd-api.jpl.nasa.gov/cad.api");
    url.searchParams.set("date-min", "now");
    url.searchParams.set("date-max", "+60");
    url.searchParams.set("dist-max", "0.05");
    url.searchParams.set("sort", "date");
    url.searchParams.set("limit", "20");
    url.searchParams.set("fullname", "true");
    url.searchParams.set("diameter", "true");
    const raw = await fetchJson(url.toString(), 3600, {
      "User-Agent": "ORBIT-AND-ORIGIN-Science-Observatory/1.0",
    });
    if (!raw || typeof raw !== "object") {
      throw new Error("JPL CAD returned an unexpected response.");
    }
    const payload = raw as Record<string, unknown>;
    if (!Array.isArray(payload.fields) || !Array.isArray(payload.data)) {
      throw new Error("JPL CAD did not return its documented fields and data arrays.");
    }
    const fields = payload.fields.filter((field): field is string => typeof field === "string");
    const rows = payload.data.filter((row): row is unknown[] => Array.isArray(row));
    const approaches = normalizeCloseApproaches(fields, rows);
    const signature = payload.signature && typeof payload.signature === "object"
      ? payload.signature as Record<string, unknown> : {};
    return NextResponse.json({
      approaches, count: approaches.length,
      total: Number(payload.count) || approaches.length,
      query: { horizonDays: 60, maximumDistanceAu: 0.05, targetBody: "Earth" },
      source: "NASA/JPL Center for Near-Earth Object Studies",
      sourceUrl: "https://cneos.jpl.nasa.gov/ca/",
      documentationUrl: "https://ssd-api.jpl.nasa.gov/doc/cad.html",
      apiVersion: typeof signature.version === "string" ? signature.version : null,
      retrievedAt: new Date().toISOString(),
      interpretationNote: "A close approach is not a prediction of impact. Nominal distance, uncertainty bounds and object properties are presented as JPL reports them; unknown diameters remain unknown.",
    });
  } catch (error) {
    return providerFailure("NASA/JPL Close Approach Data", error);
  }
}
