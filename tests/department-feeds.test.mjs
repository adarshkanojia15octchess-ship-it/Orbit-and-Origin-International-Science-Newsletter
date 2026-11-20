import assert from "node:assert/strict";
import test from "node:test";
import { parseSyndicationFeed } from "../lib/science/feed-parser.mjs";

const options = {
  sourceId: "test-source",
  sourceName: "Test Observatory",
  recordType: "Institutional news release",
  allowedHosts: ["example.org"],
};

test("RSS parser normalizes title, summary, date and source link", () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0"><channel><item>
      <title><![CDATA[A new observatory &amp; its first light]]></title>
      <link>https://news.example.org/releases/first-light</link>
      <pubDate>Fri, 20 Nov 2026 05:30:00 GMT</pubDate>
      <description><![CDATA[<p>Researchers report a new observation.</p>]]></description>
      <category>astronomy</category>
    </item></channel></rss>`;
  const items = parseSyndicationFeed(xml, options);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "A new observatory & its first light");
  assert.equal(items[0].summary, "Researchers report a new observation.");
  assert.equal(items[0].publishedAt, "2026-11-20T05:30:00.000Z");
  assert.equal(items[0].url, "https://news.example.org/releases/first-light");
  assert.deepEqual(items[0].categories, ["astronomy"]);
});

test("Atom parser reads alternate hrefs, published dates and namespaced content", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>New materials under extreme conditions</title>
      <link rel="alternate" type="text/html" href="https://example.org/research/materials"/>
      <published>2026-11-19T16:00:00Z</published>
      <summary>Scientists describe a new materials result.</summary>
      <category term="astro-ph.GA" scheme="https://arxiv.org/schemas/atom"/>
    </entry>
  </feed>`;
  const items = parseSyndicationFeed(xml, options);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.org/research/materials");
  assert.equal(items[0].publishedAt, "2026-11-19T16:00:00.000Z");
  assert.deepEqual(items[0].categories, ["astro-ph.GA"]);
});

test("parser rejects non-HTTPS and off-domain article links", () => {
  const xml = `<rss><channel>
    <item><title>Insecure</title><link>http://example.org/story</link></item>
    <item><title>Offsite</title><link>https://untrusted.example/story</link></item>
  </channel></rss>`;
  assert.deepEqual(parseSyndicationFeed(xml, options), []);
});

test("parser preserves a useful record when publication date is absent", () => {
  const xml = `<rss><channel><item>
    <title>Undated update</title><link>https://example.org/undated</link>
    <description>Metadata supplied no timestamp.</description>
  </item></channel></rss>`;
  const items = parseSyndicationFeed(xml, options);
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, null);
});
