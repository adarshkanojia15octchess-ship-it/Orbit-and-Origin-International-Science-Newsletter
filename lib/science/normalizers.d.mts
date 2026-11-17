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

export type GaiaStar = {
  sourceId: string; designation: string | null; raDeg: number | null; decDeg: number | null;
  parallaxMas: number | null; parallaxErrorMas: number | null; parallaxSignalToNoise: number | null;
  properMotionRaMasYr: number | null; properMotionDecMasYr: number | null;
  gMagnitude: number | null; distancePc: number | null;
};
export type EuclidObservation = {
  id: string; collection: string | null; productType: string | null; calibrationLevel: number | null;
  targetName: string | null; raDeg: number | null; decDeg: number | null;
  observationMjd: number | null; accessFormat: string | null;
};
export type EarthquakeEvent = {
  id: string; title: string | null; place: string | null; magnitude: number | null;
  magnitudeType: string | null; time: number | null; depthKm: number | null;
  longitude: number | null; latitude: number | null; felt: number | null;
  tsunami: boolean; significance: number | null; eventUrl: string;
};
export type CloseApproach = {
  designation: string; dateTime: string; distanceAu: number | null;
  minimumDistanceAu: number | null; relativeVelocityKmS: number | null;
  absoluteMagnitude: number | null; diameterKm: number | null;
};
export function unwrapTapRows(payload: unknown): unknown[] | null;
export function normalizeGaiaRows(rows: unknown[]): GaiaStar[];
export function normalizeEuclidRows(rows: unknown[]): EuclidObservation[];
export function normalizeEarthquakeFeatures(features: unknown[]): EarthquakeEvent[];
export function normalizeCloseApproaches(fields: string[], rows: unknown[][]): CloseApproach[];
