import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePlanetRows,
  normalizeSolarEvents,
  normalizeGaiaRows,
  normalizeEuclidRows,
  normalizeEarthquakeFeatures,
  normalizeCloseApproaches,
  unwrapTapRows,
  parseArxivFeed,
  titleSimilarity,
} from "../lib/science/normalizers.mjs";

test("arXiv parser extracts titles, authors, categories and preprint identifiers", () => {
  const xml = [
    '<?xml version="1.0"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">',
    '<opensearch:totalResults>1</opensearch:totalResults>',
    '<entry>',
    '<id>https://arxiv.org/abs/2601.01234v1</id>',
    '<title>Mapping galaxies &amp; cosmic structure</title>',
    '<summary>We study the large-scale structure of the Universe.</summary>',
    '<published>2026-01-05T12:00:00Z</published>',
    '<updated>2026-01-06T12:00:00Z</updated>',
    '<author><name>Jane Example</name></author>',
    '<author><name>Alex Researcher</name></author>',
    '<category term="astro-ph.CO" scheme="https://arxiv.org/schemas/atom"/>',
    '<arxiv:doi>10.1234/example.1</arxiv:doi>',
    '<arxiv:journal_ref>Journal of Example Science</arxiv:journal_ref>',
    '<link href="https://arxiv.org/abs/2601.01234v1" rel="alternate" type="text/html"/>',
    '</entry>',
    '</feed>',
  ].join("\n");
  const parsed = parseArxivFeed(xml);
  assert.equal(parsed.totalResults, 1);
  assert.equal(parsed.papers.length, 1);
  assert.equal(parsed.papers[0].id, "2601.01234v1");
  assert.equal(parsed.papers[0].title, "Mapping galaxies & cosmic structure");
  assert.deepEqual(parsed.papers[0].authors, ["Jane Example", "Alex Researcher"]);
  assert.deepEqual(parsed.papers[0].categories, ["astro-ph.CO"]);
  assert.equal(parsed.papers[0].doi, "10.1234/example.1");
  assert.equal(parsed.papers[0].recordType, "arXiv preprint");
});

test("exoplanet normaliser keeps valid names and converts nullable measurements", () => {
  const planets = normalizePlanetRows([
    { pl_name: "Kepler-186 f", hostname: "Kepler-186", disc_year: "2014", pl_rade: "1.17", pl_bmasse: null, pl_orbper: "129.9", sy_dist: "178" },
    { pl_name: "", hostname: "invalid" },
    null,
  ]);
  assert.equal(planets.length, 1);
  assert.equal(planets[0].name, "Kepler-186 f");
  assert.equal(planets[0].discoveryYear, 2014);
  assert.equal(planets[0].radiusEarth, 1.17);
  assert.equal(planets[0].massEarth, null);
});

test("solar event normaliser maps CME and flare fields without inventing values", () => {
  const events = normalizeSolarEvents(
    [{ activityID: "CME-1", startTime: "2026-11-16T10:00Z", sourceLocation: "N12E34", link: "https://example.nasa.gov/cme" }],
    [{ flrID: "FLR-1", beginTime: "2026-11-17T08:00Z", peakTime: "2026-11-17T08:10Z", classType: "M2.1", link: "https://example.nasa.gov/flare" }],
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].category, "FLR");
  assert.equal(events[0].classification, "M2.1");
  assert.equal(events[1].category, "CME");
  assert.equal(events[1].sourceLocation, "N12E34");
});

test("Crossref title matching rewards exact titles and rejects unrelated records", () => {
  assert.equal(titleSimilarity("A Map of the Cosmic Web", "A Map of the Cosmic Web"), 1);
  assert.ok(titleSimilarity("A Map of the Cosmic Web", "Mapping the Cosmic Web") > 0);
  assert.equal(titleSimilarity("Solar flares in active regions", "Antibiotic resistance in bacteria"), 0);
});


test("TAP wrapper accepts object rows and positional rows with metadata", () => {
  assert.deepEqual(unwrapTapRows([{ source_id: "1" }]), [{ source_id: "1" }]);
  assert.deepEqual(unwrapTapRows({
    metadata: [{ name: "source_id" }, { name: "parallax" }],
    data: [["1", 50]],
  }), [{ source_id: "1", parallax: 50 }]);
  assert.equal(unwrapTapRows({ error: "bad query" }), null);
});

test("Gaia normaliser computes inverse parallax only for positive parallax", () => {
  const stars = normalizeGaiaRows([
    { source_id: "123", designation: "Gaia DR3 123", ra: "12.5", dec: "-4", parallax: "100", parallax_error: "1", parallax_over_error: "100", pmra: "5", pmdec: "-3", phot_g_mean_mag: "8.4" },
    { source_id: "456", parallax: null },
    { source_id: null },
  ]);
  assert.equal(stars.length, 2);
  assert.equal(stars[0].distancePc, 10);
  assert.equal(stars[0].gMagnitude, 8.4);
  assert.equal(stars[1].distancePc, null);
});

test("Euclid normaliser preserves observation identifiers and metadata", () => {
  const rows = normalizeEuclidRows([
    { obs_id: "OBS-1", obs_collection: "Q1", dataproduct_type: "image", calib_level: "2", target_name: "EDFN", s_ra: "22.1", s_dec: "-5.2", t_min: "60000.5", access_format: "image/fits" },
    { obs_id: null },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].targetName, "EDFN");
  assert.equal(rows[0].calibrationLevel, 2);
  assert.equal(rows[0].observationMjd, 60000.5);
});

test("USGS GeoJSON normaliser retains event geometry, source link and tsunami flag", () => {
  const events = normalizeEarthquakeFeatures([{
    id: "us123",
    properties: { title: "M 5.0 - Example", place: "Example region", mag: 5, magType: "mb", time: 1000, url: "https://earthquake.usgs.gov/earthquakes/eventpage/us123", felt: 12, tsunami: 1, sig: 400 },
    geometry: { type: "Point", coordinates: [78.5, 28.6, 12] },
  }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].latitude, 28.6);
  assert.equal(events[0].depthKm, 12);
  assert.equal(events[0].tsunami, true);
});

test("JPL CAD normaliser maps fields by header and preserves unknown diameter", () => {
  const approaches = normalizeCloseApproaches(
    ["des", "cd", "dist", "v_rel", "h", "diameter", "fullname"],
    [["2026 AB", "2026-Nov-20 12:00", "0.02", "12.5", "22", null, "2026 AB (Example)"]],
  );
  assert.equal(approaches.length, 1);
  assert.equal(approaches[0].designation, "2026 AB (Example)");
  assert.equal(approaches[0].distanceAu, 0.02);
  assert.equal(approaches[0].diameterKm, null);
});
