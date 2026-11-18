"use client";

import { useEffect, useState } from "react";

type CosmicObject = {
  id:string; title:string; label:string; scale:string; body:string; imageUrl:string|null;
  imageTitle:string|null; imagePageUrl:string|null; imageCredit:string|null; source:string;
};
type Payload = {
  objects:CosmicObject[];
  scalePath:Array<{label:string;detail:string}>;
  sources:Array<{name:string;url:string}>;
  retrievedAt:string;
  editorialNote:string;
};

export default function CosmicNeighborhood() {
  const [data,setData] = useState<Payload|null>(null);
  const [error,setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/science/cosmic-neighborhood",{signal:controller.signal,headers:{Accept:"application/json"}})
      .then(async response => {
        if(!response.ok) throw new Error("Cosmic-neighbourhood data is temporarily unavailable.");
        return response.json() as Promise<Payload>;
      })
      .then(setData)
      .catch(reason => { if(!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Data unavailable."); });
    return () => controller.abort();
  },[]);

  return (
    <section className="oo-cosmic-section" aria-labelledby="oo-cosmic-title">
      <header className="oo-cosmic-heading">
        <span className="oo-eyebrow">COSMIC NEIGHBOURHOOD · GALACTIC ADDRESS</span>
        <h2 id="oo-cosmic-title">From our Solar System<br/><em>to the cosmic web.</em></h2>
        <p>Place our planetary home inside the larger structures astronomers map: our galaxy, our nearby galactic group, and the immense network beyond.</p>
      </header>
      <div className="oo-cosmic-path" aria-label="Our cosmic address">
        {(data?.scalePath || [
          {label:"Solar System",detail:"One planetary system"},{label:"Milky Way",detail:"Our home galaxy"},
          {label:"Local Group",detail:"Nearby galaxies"},{label:"Laniakea",detail:"A supercluster region"},
          {label:"Cosmic Web",detail:"Filaments and voids"}
        ]).map((step,index)=><div className="oo-cosmic-path-step" key={step.label}>
          <span>0{index+1}</span><strong>{step.label}</strong><small>{step.detail}</small>
        </div>)}
      </div>
      {error && <p className="oo-observatory-error" role="status">{error}</p>}
      <div className="oo-cosmic-grid">
        {(data?.objects || []).map(object=><article className="oo-cosmic-card" key={object.id}>
          {object.imageUrl ? <a className="oo-cosmic-image" href={object.imagePageUrl || object.source} target="_blank" rel="noreferrer">
            <img src={object.imageUrl} alt={object.imageTitle || object.title} loading="lazy"/>
          </a> : <div className="oo-cosmic-image oo-cosmic-image-fallback" role="img" aria-label="NASA image unavailable">
            <span>DEEP SKY / {object.id.replaceAll("-"," ").toUpperCase()}</span>
          </div>}
          <div className="oo-cosmic-copy">
            <span className="oo-eyebrow">{object.label}</span><h3>{object.title}</h3>
            <p className="oo-cosmic-scale">{object.scale}</p><p>{object.body}</p>
            <a className="oo-observatory-text-link" href={object.source} target="_blank" rel="noreferrer">Scientific context ↗</a>
            {object.imageCredit && <small>{object.imageCredit}</small>}
          </div>
        </article>)}
        {!data && !error && <p className="oo-observatory-note">Loading NASA imagery and cosmic-neighbourhood context…</p>}
      </div>
      <footer className="oo-cosmic-sources">
        <div><span className="oo-eyebrow">READING THE COSMOS</span>
          <p>The scientific framing here follows *Tapestry of Worlds: Beyond Solar System and Universe* by Adarsh Kanojia and Rishi K. Pal, especially its discussion of galaxy formation, the Milky Way, filaments, clusters and cosmic voids. Current counts and descriptions are checked against the linked NASA references.</p>
        </div>
        <div className="oo-cosmic-source-links">{(data?.sources || []).map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a>)}</div>
        {data?.retrievedAt && <small>NASA image search checked {new Date(data.retrievedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST. {data.editorialNote}</small>}
      </footer>
    </section>
  );
}
