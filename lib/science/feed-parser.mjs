function decodeXml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function textTag(block, name) {
  const expression = new RegExp(
    "<(?:(?:[a-z0-9_.-]+):)?" + name + "\\b[^>]*>([\\s\\S]*?)</(?:(?:[a-z0-9_.-]+):)?" + name + "\\s*>",
    "i",
  );
  const match = block.match(expression);
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function attribute(tag, name) {
  const match = tag.match(new RegExp("(?:^|\\s)" + name + "=[\"']([^\"']+)[\"']", "i"));
  return match ? decodeXml(match[1]) : "";
}

function safeFeedLink(value, allowedHosts) {
  if (!value || typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed = allowedHosts.some((root) => host === root || host.endsWith("." + root));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function summaryText(value) {
  return decodeXml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 620);
}

function parseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function entryLink(block, isAtom) {
  if (isAtom) {
    const links = block.match(/<link\b[^>]*>/gi) || [];
    const alternate = links.find((tag) => attribute(tag, "rel") === "alternate") || links[0];
    return alternate ? attribute(alternate, "href") : "";
  }
  return textTag(block, "link") || textTag(block, "guid");
}

/**
 * Parse RSS 2.0 and Atom entries into display-safe records. Each article URL
 * is restricted to the publisher's configured HTTPS host allow-list.
 *
 * @param {string} xml
 * @param {{sourceId:string,sourceName:string,recordType:string,allowedHosts:string[]}} options
 */
export function parseSyndicationFeed(xml, options) {
  if (typeof xml !== "string" || xml.length > 2_000_000) return [];
  const isAtom = /<feed\b/i.test(xml) && /<entry\b/i.test(xml);
  const blocks = xml.match(isAtom
    ? /<entry\b[^>]*>[\s\S]*?<\/entry>/gi
    : /<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];

  return blocks.flatMap((block) => {
    const title = textTag(block, "title");
    const rawLink = entryLink(block, isAtom);
    const url = safeFeedLink(rawLink, options.allowedHosts);
    if (!title || !url) return [];

    const rawDate = textTag(block, "pubDate") ||
      textTag(block, "published") ||
      textTag(block, "updated") ||
      textTag(block, "date");
    const publishedAt = parseDate(rawDate);
    const rawSummary = textTag(block, "description") ||
      textTag(block, "summary") ||
      textTag(block, "content");
    const categories = Array.from(block.matchAll(/<category\b[^>]*\/?>/gi))
      .map((match) => attribute(match[0], "term") || textTag(match[0], "category"))
      .filter(Boolean)
      .slice(0, 6);

    return [{
      id: options.sourceId + ":" + url,
      title: summaryText(title).slice(0, 240),
      summary: summaryText(rawSummary),
      url,
      publishedAt,
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      recordType: options.recordType,
      categories,
    }];
  });
}
