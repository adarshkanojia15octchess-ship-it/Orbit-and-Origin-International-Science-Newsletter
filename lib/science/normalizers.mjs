function decodeXml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textFromTag(block, tag) {
  const match = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  if (!match) return "";
  return decodeXml(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** @param {string} xml */
export function parseArxivFeed(xml) {
  const entries = xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) || [];
  const totalMatch = xml.match(/<opensearch:totalResults\b[^>]*>([\s\S]*?)<\/opensearch:totalResults>/i);
  const papers = entries.map((entry) => {
    const authors = Array.from(entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi))
      .map((match) => textFromTag(match[1], "name"))
      .filter(Boolean);
    const categories = Array.from(entry.matchAll(/<category\b[^>]*term=["']([^"']+)["'][^>]*\/?\s*>/gi))
      .map((match) => decodeXml(match[1]))
      .filter(Boolean);
    const linkMatch = entry.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
    const id = textFromTag(entry, "id");
    const abstractUrl = linkMatch ? decodeXml(linkMatch[1]) : id.replace(/^http:/, "https:");
    const arxivId = id.match(/abs\/([^?#]+)/i)?.[1] || "";
    return {
      id: arxivId,
      title: cleanText(textFromTag(entry, "title")),
      authors,
      abstract: cleanText(textFromTag(entry, "summary")),
      submittedAt: textFromTag(entry, "published"),
      updatedAt: textFromTag(entry, "updated"),
      url: abstractUrl,
      categories,
      doi: textFromTag(entry, "arxiv:doi") || null,
      journalReference: textFromTag(entry, "arxiv:journal_ref") || null,
      recordType: "arXiv preprint",
    };
  }).filter((paper) => paper.id && paper.title && paper.url);
  return {
    totalResults: totalMatch ? Number(cleanText(totalMatch[1])) || papers.length : papers.length,
    papers,
  };
}

/** @param {unknown[]} rows */
export function normalizePlanetRows(rows) {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = /** @type {Record<string, unknown>} */ (row);
    if (typeof item.pl_name !== "string" || !item.pl_name.trim()) return [];
    const numberOrNull = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    return [{
      name: item.pl_name,
      hostName: typeof item.hostname === "string" ? item.hostname : null,
      discoveryMethod: typeof item.discoverymethod === "string" ? item.discoverymethod : null,
      discoveryYear: numberOrNull(item.disc_year),
      radiusEarth: numberOrNull(item.pl_rade),
      massEarth: numberOrNull(item.pl_bmasse),
      orbitalPeriodDays: numberOrNull(item.pl_orbper),
      distanceParsecs: numberOrNull(item.sy_dist),
    }];
  });
}

/** @param {unknown} cmes @param {unknown} flares */
export function normalizeSolarEvents(cmes, flares) {
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const mapItems = (items, kind) => safeArray(items).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const data = /** @type {Record<string, unknown>} */ (item);
    const startTime = typeof data.startTime === "string"
      ? data.startTime
      : typeof data.beginTime === "string" ? data.beginTime : null;
    const id = typeof data.activityID === "string"
      ? data.activityID
      : typeof data.flrID === "string" ? data.flrID
      : kind + "-" + (startTime || "unknown");
    const link = typeof data.link === "string" && /^https:\/\//.test(data.link) ? data.link : null;
    const classType = typeof data.classType === "string" ? data.classType : null;
    const sourceLocation = typeof data.sourceLocation === "string" ? data.sourceLocation : null;
    const note = typeof data.note === "string" ? data.note : null;
    return [{
      id,
      type: kind === "CME" ? "Coronal mass ejection" : "Solar flare",
      category: kind,
      startTime,
      peakTime: typeof data.peakTime === "string" ? data.peakTime : null,
      endTime: typeof data.endTime === "string" ? data.endTime : null,
      classification: classType,
      sourceLocation,
      note,
      sourceUrl: link,
    }];
  });
  return [...mapItems(cmes, "CME"), ...mapItems(flares, "FLR")]
    .sort((a, b) => String(b.startTime || "").localeCompare(String(a.startTime || "")));
}

/** @param {string} left @param {string} right */
export function titleSimilarity(left, right) {
  const stopWords = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
  const tokens = (value) => new Set(
    String(value).toLowerCase().normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/).filter((token) => token.length > 1 && !stopWords.has(token)),
  );
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(a.size, b.size);
}


export function unwrapTapRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const value = /** @type {Record<string, unknown>} */ (payload);
  const rows = Array.isArray(value.data) ? value.data
    : Array.isArray(value.rows) ? value.rows
    : Array.isArray(value.results) ? value.results : null;
  if (!rows) return null;
  const metadata = Array.isArray(value.metadata) ? value.metadata : [];
  const names = metadata.map((column) => {
    if (!column || typeof column !== "object") return "";
    const item = /** @type {Record<string, unknown>} */ (column);
    return typeof item.name === "string" ? item.name : "";
  });
  return rows.map((row) => {
    if (!Array.isArray(row)) return row;
    return Object.fromEntries(names.map((name, index) => [name || String(index), row[index]]));
  });
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function nullableString(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

/** @param {unknown[]} rows */
export function normalizeGaiaRows(rows) {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = /** @type {Record<string, unknown>} */ (row);
    const sourceId = nullableString(item.source_id);
    if (!sourceId) return [];
    const parallaxMas = finiteNumber(item.parallax);
    return [{
      sourceId, designation: nullableString(item.designation),
      raDeg: finiteNumber(item.ra), decDeg: finiteNumber(item.dec),
      parallaxMas, parallaxErrorMas: finiteNumber(item.parallax_error),
      parallaxSignalToNoise: finiteNumber(item.parallax_over_error),
      properMotionRaMasYr: finiteNumber(item.pmra),
      properMotionDecMasYr: finiteNumber(item.pmdec),
      gMagnitude: finiteNumber(item.phot_g_mean_mag),
      distancePc: parallaxMas !== null && parallaxMas > 0 ? 1000 / parallaxMas : null,
    }];
  });
}

/** @param {unknown[]} rows */
export function normalizeEuclidRows(rows) {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = /** @type {Record<string, unknown>} */ (row);
    const id = nullableString(item.obs_id);
    if (!id) return [];
    return [{
      id, collection: nullableString(item.obs_collection),
      productType: nullableString(item.dataproduct_type),
      calibrationLevel: finiteNumber(item.calib_level),
      targetName: nullableString(item.target_name),
      raDeg: finiteNumber(item.s_ra), decDeg: finiteNumber(item.s_dec),
      observationMjd: finiteNumber(item.t_min),
      accessFormat: nullableString(item.access_format),
    }];
  });
}

/** @param {unknown[]} features */
export function normalizeEarthquakeFeatures(features) {
  return features.flatMap((feature) => {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) return [];
    const item = /** @type {Record<string, unknown>} */ (feature);
    const properties = item.properties && typeof item.properties === "object"
      ? /** @type {Record<string, unknown>} */ (item.properties) : {};
    const geometry = item.geometry && typeof item.geometry === "object"
      ? /** @type {Record<string, unknown>} */ (item.geometry) : {};
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const id = nullableString(item.id);
    const eventUrl = typeof properties.url === "string" &&
      properties.url.startsWith("https://earthquake.usgs.gov/") ? properties.url : null;
    if (!id || !eventUrl) return [];
    return [{
      id, title: nullableString(properties.title), place: nullableString(properties.place),
      magnitude: finiteNumber(properties.mag), magnitudeType: nullableString(properties.magType),
      time: finiteNumber(properties.time), depthKm: finiteNumber(coordinates[2]),
      longitude: finiteNumber(coordinates[0]), latitude: finiteNumber(coordinates[1]),
      felt: finiteNumber(properties.felt), tsunami: Number(properties.tsunami) === 1,
      significance: finiteNumber(properties.sig), eventUrl,
    }];
  }).sort((a, b) => (b.time || 0) - (a.time || 0));
}

/** @param {string[]} fields @param {unknown[][]} rows */
export function normalizeCloseApproaches(fields, rows) {
  const index = new Map(fields.map((field, position) => [field, position]));
  const value = (row, name) => {
    const position = index.get(name);
    return position === undefined ? null : row[position];
  };
  return rows.flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const designation = nullableString(value(row, "fullname")) || nullableString(value(row, "des"));
    const dateTime = nullableString(value(row, "cd"));
    if (!designation || !dateTime) return [];
    return [{
      designation, dateTime, distanceAu: finiteNumber(value(row, "dist")),
      minimumDistanceAu: finiteNumber(value(row, "dist_min")),
      relativeVelocityKmS: finiteNumber(value(row, "v_rel")),
      absoluteMagnitude: finiteNumber(value(row, "h")),
      diameterKm: finiteNumber(value(row, "diameter")),
    }];
  });
}
