export type NormalizedPlanet = {
  name: string;
  hostName: string | null;
  discoveryMethod: string | null;
  discoveryYear: number | null;
  radiusEarth: number | null;
  massEarth: number | null;
  orbitalPeriodDays: number | null;
  distanceParsecs: number | null;
};

export type SolarEvent = {
  id: string;
  type: string;
  category: "CME" | "FLR";
  startTime: string | null;
  peakTime: string | null;
  endTime: string | null;
  classification: string | null;
  sourceLocation: string | null;
  note: string | null;
  sourceUrl: string | null;
};

export type ArxivPaper = {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  submittedAt: string;
  updatedAt: string;
  url: string;
  categories: string[];
  doi: string | null;
  journalReference: string | null;
  recordType: "arXiv preprint";
};

export function parseArxivFeed(xml: string): { totalResults: number; papers: ArxivPaper[] };
export function normalizePlanetRows(rows: unknown[]): NormalizedPlanet[];
export function normalizeSolarEvents(cmes: unknown, flares: unknown): SolarEvent[];
export function titleSimilarity(left: string, right: string): number;
