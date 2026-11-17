import { NextRequest, NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { normalizePlanetRows } from "@/lib/science/normalizers.mjs";
import { EXOPLANET_METHODS } from "@/lib/science/schemas";

export const revalidate = 21600;

function escapeAdql(value: string) {
  return value.replace(/'/g, "''");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawSearch = (params.get("q") || "").trim().slice(0, 80);
  const search = rawSearch.replace(/[^a-zA-Z0-9 .-]/g, "").trim();
  const method = params.get("method") || "";
  const rawLimit = Number(params.get("limit") || "30");
  const limit = Number.isInteger(rawLimit) ? Math.min(50, Math.max(5, rawLimit)) : 30;

  if (method && !EXOPLANET_METHODS.includes(method as (typeof EXOPLANET_METHODS)[number])) {
    return NextResponse.json({ error: "That discovery-method filter is not supported." }, { status: 400 });
  }
  if (rawSearch.length > 80) {
    return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  }

  const conditions = ["pl_name IS NOT NULL"];
  if (search) {
    const literal = escapeAdql(search);
    conditions.push("(pl_name LIKE '%" + literal + "%' OR hostname LIKE '%" + literal + "%')");
  }
  if (method) conditions.push("discoverymethod = '" + escapeAdql(method) + "'");

  const query = [
    "SELECT TOP " + limit + " pl_name, hostname, discoverymethod, disc_year, pl_rade, pl_bmasse, pl_orbper, sy_dist",
    "FROM pscomppars",
    "WHERE " + conditions.join(" AND "),
    "ORDER BY disc_year DESC",
  ].join(" ");

  try {
    const url = new URL("https://exoplanetarchive.ipac.caltech.edu/TAP/sync");
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");
    const raw = await fetchJson(url.toString(), 21600);
    if (!Array.isArray(raw)) throw new Error("Exoplanet Archive returned an unexpected result format.");
    const planets = normalizePlanetRows(raw);
    return NextResponse.json({
      planets,
      count: planets.length,
      limit,
      catalogue: "Planetary Systems Composite Parameters (pscomppars)",
      source: "NASA Exoplanet Archive",
      sourceUrl: "https://exoplanetarchive.ipac.caltech.edu/",
      documentationUrl: "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html",
      queryApplied: { search: search || null, discoveryMethod: method || null },
      retrievedAt: new Date().toISOString(),
      interpretationNote: "Catalogue measurements are shown as reported. Missing values are not estimates; consult the source record and its references before scientific use.",
    });
  } catch (error) {
    return providerFailure("NASA Exoplanet Archive", error);
  }
}
