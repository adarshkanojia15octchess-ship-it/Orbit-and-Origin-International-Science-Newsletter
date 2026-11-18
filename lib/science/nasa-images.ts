import { safeExternalUrl } from "@/lib/science/http";

type NasaSearchResponse = {
  collection?: {
    items?: Array<{
      data?: Array<{ title?: string; nasa_id?: string; description?: string }>;
      links?: Array<{ rel?: string; render?: string; href?: string }>;
    }>;
  };
};

export type NasaImage = {
  title: string;
  nasaId: string;
  imageUrl: string;
  description: string;
  pageUrl: string;
};

export async function searchNasaImage(query: string): Promise<NasaImage | null> {
  try {
    const url = new URL("https://images-api.nasa.gov/search");
    url.searchParams.set("q", query.slice(0, 120));
    url.searchParams.set("media_type", "image");
    url.searchParams.set("page_size", "8");
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as NasaSearchResponse;
    for (const item of payload.collection?.items || []) {
      const record = item.data?.[0];
      const preview = item.links?.find(link => link.rel === "preview" && link.href);
      const imageUrl = safeExternalUrl(preview?.href, ["images-assets.nasa.gov"]);
      if (!record?.nasa_id || !imageUrl) continue;
      return {
        title: (record.title || query).slice(0, 180),
        nasaId: record.nasa_id.slice(0, 80),
        imageUrl,
        description: (record.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 360),
        pageUrl: "https://images.nasa.gov/details/" + encodeURIComponent(record.nasa_id),
      };
    }
    return null;
  } catch {
    return null;
  }
}
