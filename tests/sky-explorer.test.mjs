import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SKY_OBJECTS,
  clampSkyZoom,
  getSkyFocusTransform,
  getNASAObjectUrl,
  skyObjectCategory,
  validateSkyCatalogue,
} from "../lib/sky-explorer/catalogue.mjs";

test("the curated sky catalogue has unique, complete and safe records", () => {
  assert.equal(SKY_OBJECTS.length, 18);
  assert.deepEqual(validateSkyCatalogue(), []);
  const ids = SKY_OBJECTS.map((object) => object.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const object of SKY_OBJECTS) {
    assert.ok(object.name.trim());
    assert.ok(object.description.trim().length >= 40);
    assert.ok(object.importance.trim().length >= 20);
    assert.equal(new URL(object.source).protocol, "https:");
  }
});

test("Solar System objects, including the Sun, are placed in the correct category", () => {
  for (const id of ["sun", "moon", "earth", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]) {
    const object = SKY_OBJECTS.find((item) => item.id === id);
    assert.ok(object, "missing catalogue record: " + id);
    assert.equal(skyObjectCategory(object), "Solar System");
  }
  assert.equal(skyObjectCategory(SKY_OBJECTS.find((item) => item.id === "sirius")), "Stars");
  assert.equal(skyObjectCategory(SKY_OBJECTS.find((item) => item.id === "earth")), "Solar System");
  assert.equal(skyObjectCategory(SKY_OBJECTS.find((item) => item.id === "andromeda")), "Deep sky");
});

test("zoom is finite and remains inside the supported range", () => {
  assert.equal(clampSkyZoom(Number.NaN), 1);
  assert.equal(clampSkyZoom(Number.POSITIVE_INFINITY), 1);
  assert.equal(clampSkyZoom(-50), 0.7);
  assert.equal(clampSkyZoom(50), 2.8);
  assert.equal(clampSkyZoom(1.375), 1.38);
});

test("focusing any object places its marker at the map centre", () => {
  for (const object of SKY_OBJECTS) {
    const transform = getSkyFocusTransform(object, 1.65);
    assert.ok(Number.isFinite(transform.translateX));
    assert.ok(Number.isFinite(transform.translateY));
    assert.equal(object.x * transform.scale + transform.translateX, 500);
    assert.equal(object.y * transform.scale + transform.translateY, 250);
  }
});

test("NASA Eyes deep links are limited to supported Solar System catalogue objects", () => {
  for (const object of SKY_OBJECTS) {
    const url = getNASAObjectUrl(object);
    if (skyObjectCategory(object) === "Solar System" && object.eyes) {
      assert.ok(url);
      assert.equal(new URL(url).hostname, "eyes.nasa.gov");
    } else {
      assert.equal(url, null);
    }
  }
});

test("catalogue validation detects duplicate IDs and invalid map coordinates", () => {
  const base = SKY_OBJECTS[0];
  const invalid = [
    base,
    { ...base, x: 1200 },
  ];
  const errors = validateSkyCatalogue(invalid);
  assert.ok(errors.some((error) => error.includes("unique")));
  assert.ok(errors.some((error) => error.includes("coordinates")));
});


const skyPageSource = readFileSync(new URL("../app/sky-explorer/sky-explorer-client.tsx", import.meta.url), "utf8");
const rootLayoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("the Sky Explorer hero points to the book-based Cosmic Neighbourhood section", () => {
  assert.match(skyPageSource, /id="cosmic-neighbourhood"/);
  assert.match(skyPageSource, /href="#cosmic-neighbourhood"/);
  assert.doesNotMatch(skyPageSource, /href="#sky-map"/);
  assert.match(skyPageSource, /The Cosmic Web/);
  assert.match(skyPageSource, /Tapestry of Worlds: Beyond Solar System and Universe/);
});

test("the five-viewer section and Google Earth hand-off stay correctly labelled", () => {
  assert.match(skyPageSource, /NASA Eyes · Asteroids/);
  assert.match(skyPageSource, /href=\{googleEarth\}[^>]*>Open Google Earth/);
  assert.doesNotMatch(skyPageSource, /href=\{earth\}[^>]*>Open Google Earth/);
});

test("the global footer credits the book and both authors", () => {
  assert.match(rootLayoutSource, /Tapestry of Worlds: Beyond Solar System and Universe/);
  assert.match(rootLayoutSource, /Adarsh Kanojia \(author\)/);
  assert.match(rootLayoutSource, /Rishi K\. Pal \(co-author\)/);
});
