import PublisherPortalPage from "../../publisher/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Founder Workspace | ORBIT & ORIGIN" };

export default async function FounderWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return PublisherPortalPage({ searchParams });
}
