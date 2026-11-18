import type { SupabaseClient } from "@supabase/supabase-js";

const statuses = ["draft", "scheduled", "published", "archived"] as const;

export async function getPublisherOverview(supabase: SupabaseClient) {
  const [issueTotal, articleTotal, ...counts] = await Promise.all([
    supabase.from("issues").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }),
    ...statuses.flatMap((status) => [
      supabase.from("issues").select("id", { count: "exact", head: true }).eq("status", status),
      supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", status),
    ]),
  ]);

  if (issueTotal.error || articleTotal.error || counts.some((item) => item.error)) {
    throw new Error("Publisher overview could not be loaded.");
  }

  const byStatus = Object.fromEntries(statuses.map((status, index) => [
    status,
    { issues: counts[index * 2].count ?? 0, articles: counts[index * 2 + 1].count ?? 0 },
  ]));

  const [recentIssues, recentArticles] = await Promise.all([
    supabase.from("issues")
      .select("id, issue_number, title, publication_date, scheduled_at, status, updated_at")
      .order("updated_at", { ascending: false }).limit(5),
    supabase.from("articles")
      .select("id, headline, author, department, issue_id, scheduled_at, published_at, status, updated_at")
      .order("updated_at", { ascending: false }).limit(5),
  ]);

  if (recentIssues.error || recentArticles.error) {
    throw new Error("Recent editorial records could not be loaded.");
  }

  return {
    totals: { issues: issueTotal.count ?? 0, articles: articleTotal.count ?? 0 },
    byStatus,
    recentIssues: recentIssues.data ?? [],
    recentArticles: recentArticles.data ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export async function getPublisherCalendar(supabase: SupabaseClient, from: string, to: string) {
  const [issues, articles] = await Promise.all([
    supabase.from("issues")
      .select("id, issue_number, title, publication_date, scheduled_at, status")
      .in("status", ["scheduled", "published"])
      .gte("scheduled_at", from).lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true }).limit(200),
    supabase.from("articles")
      .select("id, headline, department, scheduled_at, published_at, status")
      .in("status", ["scheduled", "published"])
      .gte("scheduled_at", from).lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true }).limit(300),
  ]);

  if (issues.error || articles.error) {
    throw new Error("Publication calendar could not be loaded.");
  }

  return {
    issues: issues.data ?? [],
    articles: articles.data ?? [],
    from,
    to,
  };
}
