import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchJson, providerFailure, safeExternalUrl, stripMarkup } from "@/lib/science/http";

export const revalidate = 3600;

const ApodSchema = z.object({
  date: z.string(),
  title: z.string().min(1),
  media_type: z.string().min(1),
  explanation: z.string().optional().default(""),
  permalink: z.string().optional(),
  url: z.string().optional(),
  hdurl: z.string().optional(),
}).passthrough();

export async function GET() {
  try {
    const url = new URL("https://science.nasa.gov/wp-json/wp/v2/apod-basic");
    url.searchParams.set("per_page", "1");
    const raw = await fetchJson(url.toString(), 3600);
    const item = Array.isArray(raw) ? raw[0] : raw;
    const parsed = ApodSchema.safeParse(item);
    if (!parsed.success) throw new Error("NASA APOD response did not match the documented fields.");

    const imageUrl = parsed.data.media_type.toLowerCase() === "image"
      ? safeExternalUrl(parsed.data.hdurl, [
          "science.nasa.gov",
          "assets.science.nasa.gov",
          "images-assets.nasa.gov",
          "apod.nasa.gov",
        ])
      : null;
    const pageUrl = safeExternalUrl(
      parsed.data.permalink || parsed.data.url,
      ["science.nasa.gov"],
    );
    if (!pageUrl) throw new Error("NASA APOD response did not include a trusted publication URL.");

    return NextResponse.json({
      data: {
        date: parsed.data.date,
        title: parsed.data.title,
        mediaType: parsed.data.media_type,
        explanation: stripMarkup(parsed.data.explanation),
        imageUrl,
        alt: parsed.data.title,
        credit: "",
        pageUrl,
      },
      source: "NASA Astronomy Picture of the Day",
      sourceUrl: pageUrl,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    return providerFailure("NASA APOD", error);
  }
}
