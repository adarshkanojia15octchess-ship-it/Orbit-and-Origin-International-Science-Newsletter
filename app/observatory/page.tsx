import type { Metadata } from "next";
import ObservatoryClient from "./observatory-client";

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
          Explore scientific observations and research records from NASA, the NASA Exoplanet Archive,
          arXiv and Crossref — with the original sources kept in view.
        </p>
        <div className="oo-observatory-principle">
          <span>OPEN TO CURIOSITY.</span>
          <strong>COMMITTED TO EVIDENCE.</strong>
        </div>
      </header>
      <ObservatoryClient />
    </div>
  );
}
