import { NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { normalizeEuclidRows, unwrapTapRows } from "@/lib/science/normalizers.mjs";

export const revalidate = 43200;

const QUERY = [
  "SELECT TOP 20 obs_id, obs_collection, dataproduct_type, calib_level,",
  "target_name, s_ra, s_dec, t_min, access_format",
  "FROM ivoa.obscore ORDER BY t_min DESC",
].join(" ");

export async function GET() {
  try {
    const url = new URL("https://eas.esac.esa.int/tap-server/tap/sync");
    url.searchParams.set("REQUEST", "doQuery");
    url.searchParams.set("LANG", "ADQL");
    url.searchParams.set("FORMAT", "json");
    url.searchParams.set("QUERY", QUERY);
    const raw = await fetchJson(url.toString(), 43200, {
      "User-Agent": "ORBIT-AND-ORIGIN-Science-Observatory/1.0",
    });
    const rows = unwrapTapRows(raw);
    if (!rows) throw new Error("Euclid TAP returned an unexpected table format.");
    const observations = normalizeEuclidRows(rows);
    return NextResponse.json({
      observations, count: observations.length,
      catalogue: "ESA Euclid Science Archive · ivoa.obscore",
      source: "ESA Euclid Science Archive",
      sourceUrl: "https://eas.esac.esa.int/sas/",
      documentationUrl: "https://docs.astropy.org/projects/astroquery/en/stable/esa/euclid/euclid.html",
      retrievedAt: new Date().toISOString(),
      accessNote: "This panel shows public observation metadata only. Large science products and detailed catalogue searches belong in the original Euclid archive.",
    });
  } catch (error) {
    return providerFailure("ESA Euclid Science Archive", error);
  }
}
