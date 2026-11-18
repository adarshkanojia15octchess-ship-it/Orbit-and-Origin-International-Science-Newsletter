import type { Metadata } from "next";
import ObservatoryClient from "./observatory-client";
import CosmicNeighborhood from "./cosmic-neighborhood";

export const metadata: Metadata = {
  title: "Science Observatory",
  description: "Explore NASA space-weather data, confirmed exoplanets, astronomy imagery and current research through ORBIT & ORIGIN.",
};

export default function ObservatoryPage() {
  return (
    <div className="oo-observatory">
      <header className="oo-observatory-hero">
        <span className="oo-eyebrow">ORBIT &amp; ORIGIN · SCIENCE OBSERVATORY</span>
        <h1>Look deeper.<br /><em>Follow the evidence.</em></h1>
        <p>
          Explore observations and research records from NASA, ESA Gaia and Euclid, JPL, USGS,
          the NASA Exoplanet Archive, arXiv and Crossref — with the original sources kept in view.
        </p>
        <div className="oo-observatory-principle">
          <span>OPEN TO CURIOSITY.</span>
          <strong>COMMITTED TO EVIDENCE.</strong>
        </div>
      </header>
      <ObservatoryClient />
      <CosmicNeighborhood />
    </div>
  );
}
