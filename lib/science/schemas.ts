import { z } from "zod";

export const searchTextSchema = z.string().trim().min(1).max(100);
export const shortSearchTextSchema = z.string().trim().max(80);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const EXOPLANET_METHODS = [
  "Transit",
  "Radial Velocity",
  "Imaging",
  "Microlensing",
  "Astrometry",
  "Orbital Brightness Modulation",
  "Pulsar Timing",
  "Eclipse Timing Variations",
  "Pulsation Timing Variations",
  "Disk Kinematics",
] as const;

export const ARXIV_CATEGORIES = {
  all: [],
  astrophysics: [
    "astro-ph.CO", "astro-ph.EP", "astro-ph.GA", "astro-ph.HE",
    "astro-ph.IM", "astro-ph.SR",
  ],
  cosmology: ["astro-ph.CO"],
  exoplanets: ["astro-ph.EP"],
  solar: ["astro-ph.SR"],
  space: ["physics.space-ph"],
  relativity: ["gr-qc"],
} as const;
