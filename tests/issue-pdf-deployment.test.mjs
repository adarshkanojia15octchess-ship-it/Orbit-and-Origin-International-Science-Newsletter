import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateIssueCoverAsset,
  validateIssuePdfAsset,
  verifyPublishedIssueAssets,
} from "../src/editorial/issue-pdf-verification.mjs";

const adminActions = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
const scheduledWorker = await readFile(new URL("../app/api/cron/publish-scheduled/route.ts", import.meta.url), "utf8");

function pdf(text = "%PDF-1.7\nORBIT & ORIGIN") {
  return new Blob([new TextEncoder().encode(text)], { type: "application/pdf" });
}
function jpeg(bytes = [0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]) {
  return new Blob([Uint8Array.from(bytes)], { type: "image/jpeg" });
}

test("PDF validation checks the header and the 25 MB deployment limit", async () => {
  assert.equal(await validateIssuePdfAsset(pdf()), true);
  assert.equal(await validateIssuePdfAsset(new Blob(["not a PDF"])), false);
  const tooLarge = { size: 25 * 1024 * 1024 + 1, slice() { throw new Error("must reject by size first"); } };
  assert.equal(await validateIssuePdfAsset(tooLarge), false);
});

test("cover validation accepts only supported image signatures under 8 MB", async () => {
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])]);
  const webp = new Blob([Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])]);
  assert.equal(await validateIssueCoverAsset(jpeg(), "jpg"), true);
  assert.equal(await validateIssueCoverAsset(png, "png"), true);
  assert.equal(await validateIssueCoverAsset(webp, "webp"), true);
  assert.equal(await validateIssueCoverAsset(jpeg(), "png"), false);
  assert.equal(await validateIssueCoverAsset(jpeg(), "svg"), false);
});

test("deployment verification rejects size changes and same-size byte changes", async () => {
  const sourcePdf = pdf();
  const sourceCover = jpeg();
  assert.equal(
    await verifyPublishedIssueAssets(sourcePdf, sourceCover, pdf(), jpeg(), "jpg"),
    true,
  );
  assert.equal(
    await verifyPublishedIssueAssets(sourcePdf, sourceCover, new Blob(["%PDF-1.7\nSTARS & ORIGIN"]), sourceCover, "jpg"),
    false,
  );
  assert.equal(
    await verifyPublishedIssueAssets(sourcePdf, sourceCover, sourcePdf, jpeg([0xff, 0xd8, 0xff, 0x09, 0x02, 0x03]), "jpg"),
    false,
  );
  assert.equal(
    await verifyPublishedIssueAssets(sourcePdf, sourceCover, sourcePdf, new Blob(["short"]), "jpg"),
    false,
  );
});

test("manual publishing verifies public copies before the atomic database commit", () => {
  const action = adminActions.split("export async function publishIssue")[1]?.split("const issueEditSchema")[0] ?? "";
  assert.match(action, /validateIssuePdfAsset/);
  assert.match(action, /validateIssueCoverAsset/);
  const verifyIndex = action.indexOf("verifyPublishedIssueAssets");
  const commitIndex = action.indexOf('"complete_publication_operation"');
  assert.ok(verifyIndex >= 0 && commitIndex > verifyIndex);
  assert.match(action, /SHA-256 verification/);
});

test("scheduled publishing uses the same PDF deployment integrity gate", () => {
  assert.match(scheduledWorker, /validateIssuePdfAsset/);
  assert.match(scheduledWorker, /validateIssueCoverAsset/);
  const verifyIndex = scheduledWorker.indexOf("verifyPublishedIssueAssets");
  const commitIndex = scheduledWorker.indexOf('"complete_publication_operation"');
  assert.ok(verifyIndex >= 0 && commitIndex > verifyIndex);
  assert.match(scheduledWorker, /SHA-256 verification/);
});
