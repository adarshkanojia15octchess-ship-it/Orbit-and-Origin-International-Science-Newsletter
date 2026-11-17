import { NextRequest, NextResponse } from "next/server";
import { fetchText, providerFailure } from "@/lib/science/http";
import { parseArxivFeed } from "@/lib/science/normalizers.mjs";
import { ARXIV_CATEGORIES } from "@/lib/science/schemas";
import { waitForArxivSlot } from "@/lib/science/arxiv-throttle";

export const revalidate = 900;

type CategoryKey = keyof typeof ARXIV_CATEGORIES;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawQuery = (params.get("q") || "cosmology").trim().slice(0, 100);
  const category = (params.get("category") || "astrophysics") as CategoryKey;
  const allowedCategories = Object.keys(ARXIV_CATEGORIES);
  if (!allowedCategories.includes(category)) {
    return NextResponse.json({ error: "Choose a supported research category." }, { status: 400 });
  }

  const words = rawQuery.toLowerCase().match(/[a-z0-9-]{2,32}/g)?.slice(0, 5) || [];
  if (!words.length) {
    return NextResponse.json({ error: "Enter a search term using letters or numbers." }, { status: 400 });
  }

  const textQuery = words.map((word) => "all:" + word).join(" AND ");
  const categoryTerms = ARXIV_CATEGORIES[category];
  const categoryQuery = categoryTerms.length
    ? "(" + categoryTerms.map((term) => "cat:" + term).join(" OR ") + ") AND "
    : "";
  const searchQuery = categoryQuery + "(" + textQuery + ")";

  try {
    await waitForArxivSlot();
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", searchQuery);
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", "20");
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");
    const xml = await fetchText(url.toString(), 900, {
      "User-Agent": "ORBIT-AND-ORIGIN-Science-Observatory/1.0",
    });
    const result = parseArxivFeed(xml);
    return NextResponse.json({
      papers: result.papers,
      totalResults: result.totalResults,
      returned: result.papers.length,
      query: rawQuery,
      category,
      recordType: "arXiv preprints",
      source: "arXiv",
      sourceUrl: "https://arxiv.org/",
      documentationUrl: "https://info.arxiv.org/help/api/user-manual.html",
      retrievedAt: new Date().toISOString(),
      editorialNote: "arXiv records are preprints unless a journal reference is independently listed. A preprint is not automatically peer reviewed.",
    });
  } catch (error) {
    return providerFailure("arXiv Research Radar", error);
  }
}
