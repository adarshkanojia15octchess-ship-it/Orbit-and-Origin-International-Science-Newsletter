export const revalidate = 21600;

const ENDPOINT = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

export async function GET() {
  const now = new Date();
  const candidateDates = [1, 2, 3, 4].map((daysAgo) =>
    new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  for (const date of candidateDates) {
    const params = new URLSearchParams({
      SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetMap",
      FORMAT: "image/jpeg", TRANSPARENT: "false",
      LAYERS: "MODIS_Terra_CorrectedReflectance_TrueColor",
      SRS: "EPSG:4326", STYLES: "", WIDTH: "1536", HEIGHT: "768",
      BBOX: "-180,-90,180,90", TIME: date,
    });
    try {
      const response = await fetch(ENDPOINT + "?" + params.toString(), {
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(18000),
        headers: { Accept: "image/jpeg" },
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.toLowerCase().startsWith("image/")) continue;
      return new Response(await response.arrayBuffer(), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
          "X-Imagery-Date": date,
          "X-Imagery-Source": "NASA GIBS MODIS Terra Corrected Reflectance True Color",
        },
      });
    } catch {
      // Try an earlier composite if the newest day has not been published.
    }
  }
  return Response.json(
    { error: "NASA Earth imagery is temporarily unavailable. Open the GIBS catalogue to inspect available layers." },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
