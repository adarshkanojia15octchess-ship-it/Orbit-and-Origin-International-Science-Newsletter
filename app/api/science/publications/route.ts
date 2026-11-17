import { NextRequest, NextResponse } from "next/server";
import { fetchJson, providerFailure } from "@/lib/science/http";
import { titleSimilarity } from "@/lib/science/normalizers.mjs";

export const revalidate = 3600;

type CrossrefItem = Record<string, unknown>;

function firstString(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return typeof value === "string" ? value : null;
}

function dateFromParts(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const dateParts = (value as Record<string, unknown>)["date-parts"];
  if (!Array.isArray(dateParts) || !Array.isArray(dateParts[0])) return null;
  const parts = dateParts[0].map(Number);
  if (!parts.length || !Number.isFinite(parts[0])) return null;
  return parts.map((part, index) => index === 0 ? String(part).padStart(4, "0") : String(part).padStart(2, "0")).join("-");
}

export async function GET(request: NextRequest) {
  const title = (request.nextUrl.searchParams.get("title") || "").trim().slice(0, 180);
  const author = (request.nextUrl.searchParams.get("author") || "").trim().slice(0, 100);
  if (title.length < 8) {
    return NextResponse.json({ error: "Provide a paper title with at least eight characters." }, { status: 400 });
  }

  try {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.title", title);
    if (author) url.searchParams.set("query.author", author);
    url.searchParams.set("rows", "5");
    url.searchParams.set("select", "DOI,title,author,published,published-print,published-online,publisher,container-title,type,URL");
    const contact = process.env.CROSSREF_MAILTO || process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    if (contact) url.searchParams.set("mailto", contact);

    const raw = await fetchJson(url.toString(), 3600, {
      "User-Agent": "ORBIT-AND-ORIGIN-Science-Observatory/1.0" + (contact ? " (mailto:" + contact + ")" : ""),
    });
    const message = raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).message as Record<string, unknown> | undefined
      : undefined;
    const items = Array.isArray(message?.items) ? message.items : [];
    const candidates = (items as CrossrefItem[]).flatMap((item) => {
      const candidateTitle = firstString(item.title);
      const doi = typeof item.DOI === "string" ? item.DOI : null;
      if (!candidateTitle || !doi) return [];
      const similarity = titleSimilarity(title, candidateTitle);
      const authors = Array.isArray(item.author)
        ? item.author.flatMap((person) => {
            if (!person || typeof person !== "object") return [];
            const data = person as Record<string, unknown>;
            const name = [data.given, data.family].filter((part) => typeof part === "string").join(" ");
            return name ? [name] : [];
          }).slice(0, 8)
        : [];
      return [{
        title: candidateTitle,
        doi,
        doiUrl: "https://doi.org/" + doi,
        authors,
        publisher: typeof item.publisher === "string" ? item.publisher : null,
        journal: firstString(item["container-title"]),
        publicationDate: dateFromParts(item.published || item["published-print"] || item["published-online"]),
        workType: typeof item.type === "string" ? item.type : null,
        sourceUrl: typeof item.URL === "string" ? item.URL : "https://doi.org/" + doi,
        titleSimilarity: Number(similarity.toFixed(3)),
        matchLabel: similarity >= 0.85 ? "Strong title match" : similarity >= 0.6 ? "Possible title match" : "Weak title match",
      }];
    }).sort((a, b) => b.titleSimilarity - a.titleSimilarity);

    return NextResponse.json({
      candidates,
      source: "Crossref REST API",
      sourceUrl: "https://api.crossref.org/",
      retrievedAt: new Date().toISOString(),
      guidance: "Crossref supplies publication metadata. A title match is a research lead, not proof that two records are the same work; open the DOI record and compare authors and content before citing.",
    });
  } catch (error) {
    return providerFailure("Crossref publication metadata", error);
  }
}
