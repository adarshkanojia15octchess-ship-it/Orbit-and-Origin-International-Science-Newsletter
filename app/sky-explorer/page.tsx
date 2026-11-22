import type { Metadata } from "next";
import SkyExplorer from "./sky-explorer-client";
export const metadata: Metadata = {
  title: "Sky Explorer",
  description: "An interactive sky atlas connecting Stellarium, NASA's Eyes and trusted astronomy catalogues.",
};
export default function SkyExplorerPage() { return <SkyExplorer />; }
