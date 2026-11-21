export declare function validateIssuePdfAsset(asset: Blob | null | undefined): Promise<boolean>;
export declare function validateIssueCoverAsset(
  asset: Blob | null | undefined,
  extension: string,
): Promise<boolean>;
export declare function verifyPublishedIssueAssets(
  sourcePdf: Blob | null | undefined,
  sourceCover: Blob | null | undefined,
  publishedPdf: Blob | null | undefined,
  publishedCover: Blob | null | undefined,
  coverExtension: string,
): Promise<boolean>;
