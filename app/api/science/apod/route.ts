import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchJson,
  fetchText,
  providerFailure,
  safeExternalUrl,
  stripMarkup,
} from "@/lib/science/http";

export const revalidate = 3600;

const ApodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  media_type: z.string().min(1),
  explanation: z.string().optional().default(""),
  permalink: z.string().optional(),
  url: z.string().optional(),
  hdurl: z.string().optional(),
  alt: z.string().optional(),
  credit: z.string().optional(),
  copyright: z.string().optional(),
}).passthrough();

function readXmlTag(xml: string, tag: "link" | "guid" | "pubDate"): string | null {
  const match = xml.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  if (!match?.[1]) return null;
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&")
    .trim();
}

function canonicalPage(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "science.nasa.gov") return null;
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function findPublishedAt(rss: string, pageUrl: string): string | null {
  const target = canonicalPage(pageUrl);
  if (!target) return null;
  const items = rss.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const item of items) {
    const link = readXmlTag(item, "link");
    const guid = readXmlTag(item, "guid");
    if ([link, guid].some((candidate) => candidate && canonicalPage(candidate) === target)) {
      const published = readXmlTag(item, "pubDate");
      if (!published) return null;
      const parsed = new Date(published);
      return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    }
  }
  return null;
}

export async function GET() {
  try {
    const jsonUrl = new URL("https://science.nasa.gov/wp-json/wp/v2/apod-basic");
    jsonUrl.searchParams.set("per_page", "1");

    const [raw, rss] = await Promise.all([
      fetchJson(jsonUrl.toString(), 3600),
      fetchText("https://science.nasa.gov/feed/apod-basic/", 3600).catch((error: unknown) => {
        console.warn(
          "[science-observatory:NASA APOD RSS]",
          error instanceof Error ? error.message : "Publication timestamp feed unavailable",
        );
        return "";
      }),
    ]);

    const item = Array.isArray(raw) ? raw[0] : raw;
    const parsed = ApodSchema.safeParse(item);
    if (!parsed.success) {
      throw new Error("NASA APOD response did not match the documented fields.");
    }

    const mediaType = parsed.data.media_type.toLowerCase();
    const imageUrl = mediaType === "image"
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
    if (!pageUrl) {
      throw new Error("NASA APOD response did not include a trusted publication URL.");
    }

    const retrievedAt = new Date().toISOString();
    const publishedAt = rss ? findPublishedAt(rss, pageUrl) : null;

    return NextResponse.json({
      data: {
        date: parsed.data.date,
        title: stripMarkup(parsed.data.title),
        mediaType,
        explanation: stripMarkup(parsed.data.explanation),
        imageUrl,
        imageResolution: imageUrl ? "full-size APOD image URL supplied by NASA" : null,
        alt: stripMarkup(parsed.data.alt || parsed.data.title),
        credit: stripMarkup(parsed.data.credit || ""),
        copyright: stripMarkup(parsed.data.copyright || ""),
        pageUrl,
        publishedAt,
        captureTime: null,
      },
      source: "NASA Astronomy Picture of the Day",
      sourceUrl: pageUrl,
      retrievedAt,
    });
  } catch (error) {
    return providerFailure("NASA APOD", error);
  }
}
