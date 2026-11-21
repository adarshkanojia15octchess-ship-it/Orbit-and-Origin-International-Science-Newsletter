import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

async function hasPrefix(asset, expected, offset = 0) {
  const bytes = new Uint8Array(await asset.slice(offset, offset + expected.length).arrayBuffer());
  return expected.every((value, index) => bytes[index] === value);
}

export async function validateIssuePdfAsset(asset) {
  if (!asset || asset.size < 5 || asset.size > MAX_PDF_BYTES) return false;
  return hasPrefix(asset, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

export async function validateIssueCoverAsset(asset, extension) {
  if (!asset || asset.size === 0 || asset.size > MAX_COVER_BYTES) return false;

  switch (String(extension || "").toLowerCase()) {
    case "jpg":
    case "jpeg":
      return hasPrefix(asset, [0xff, 0xd8, 0xff]);
    case "png":
      return hasPrefix(asset, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "webp":
      return (await hasPrefix(asset, [0x52, 0x49, 0x46, 0x46])) &&
        (await hasPrefix(asset, [0x57, 0x45, 0x42, 0x50], 8));
    default:
      return false;
  }
}

async function sha256(asset) {
  const bytes = Buffer.from(await asset.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Verify that the public issue assets are valid, within their upload limits,
 * and byte-for-byte identical to the private source assets before publication.
 */
export async function verifyPublishedIssueAssets(
  sourcePdf,
  sourceCover,
  publishedPdf,
  publishedCover,
  coverExtension,
) {
  if (!sourcePdf || !sourceCover || !publishedPdf || !publishedCover) return false;
  if (sourcePdf.size !== publishedPdf.size || sourceCover.size !== publishedCover.size) return false;

  const [sourcePdfValid, sourceCoverValid, publishedPdfValid, publishedCoverValid] = await Promise.all([
    validateIssuePdfAsset(sourcePdf),
    validateIssueCoverAsset(sourceCover, coverExtension),
    validateIssuePdfAsset(publishedPdf),
    validateIssueCoverAsset(publishedCover, coverExtension),
  ]);
  if (!sourcePdfValid || !sourceCoverValid || !publishedPdfValid || !publishedCoverValid) return false;

  const [sourcePdfHash, publishedPdfHash, sourceCoverHash, publishedCoverHash] = await Promise.all([
    sha256(sourcePdf),
    sha256(publishedPdf),
    sha256(sourceCover),
    sha256(publishedCover),
  ]);
  return sourcePdfHash === publishedPdfHash && sourceCoverHash === publishedCoverHash;
}
