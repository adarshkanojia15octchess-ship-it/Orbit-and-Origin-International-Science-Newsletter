import { NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { normalizeGaiaRows, unwrapTapRows } from "@/lib/science/normalizers.mjs";

export const revalidate = 21600;

const QUERY = [
  "SELECT TOP 24 designation, source_id, ra, dec, parallax, parallax_error,",
  "parallax_over_error, pmra, pmdec, phot_g_mean_mag",
  "FROM gaiadr3.gaia_source",
  "WHERE parallax > 50 AND parallax_over_error >= 10 AND phot_g_mean_mag IS NOT NULL",
  "ORDER BY parallax DESC",
].join(" ");

export async function GET() {
  try {
    const url = new URL("https://gea.esac.esa.int/tap-server/tap/sync");
    url.searchParams.set("REQUEST", "doQuery");
    url.searchParams.set("LANG", "ADQL");
    url.searchParams.set("FORMAT", "json");
    url.searchParams.set("QUERY", QUERY);
    const raw = await fetchJson(url.toString(), 21600, {
      "User-Agent": "ORBIT-AND-ORIGIN-Science-Observatory/1.0",
    });
    const rows = unwrapTapRows(raw);
    if (!rows) throw new Error("Gaia TAP returned an unexpected table format.");
    const stars = normalizeGaiaRows(rows);
    return NextResponse.json({
      stars, count: stars.length,
      catalogue: "Gaia Data Release 3 · gaiadr3.gaia_source",
      source: "ESA Gaia Archive",
      sourceUrl: "https://gea.esac.esa.int/archive/",
      documentationUrl: "https://gea.esac.esa.int/archive/documentation/",
      retrievedAt: new Date().toISOString(),
      methodNote: "Displayed distance is the simple inverse-parallax value (1000/parallax in milliarcseconds), not a full Bayesian distance estimate.",
      qualityNote: "The sample uses positive parallaxes above 50 mas and parallax signal-to-noise of at least 10. Consult source-level uncertainties before scientific use.",
    });
  } catch (error) {
    return providerFailure("ESA Gaia Archive", error);
  }
}
