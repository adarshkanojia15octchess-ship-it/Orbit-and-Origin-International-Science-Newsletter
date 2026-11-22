import type { Metadata } from "next";
import SkyExplorer from "./sky-explorer-client";
export const metadata: Metadata = {
  title: "Sky Explorer",
  description: "Explore our cosmic neighbourhood, curated astronomy references and specialist live-sky and NASA Eyes tools.",
};
export default function SkyExplorerPage() { return <SkyExplorer />; }
