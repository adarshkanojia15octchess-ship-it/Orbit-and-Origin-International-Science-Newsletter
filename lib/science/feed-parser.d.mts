export type SyndicationItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  sourceId: string;
  sourceName: string;
  recordType: string;
  categories: string[];
};

export function parseSyndicationFeed(
  xml: string,
  options: {
    sourceId: string;
    sourceName: string;
    recordType: string;
    allowedHosts: string[];
  },
): SyndicationItem[];
