import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

function configuredSiteHost() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const [issues, articles] = await Promise.all([
    context.supabase.from("issues").select("id", { count: "exact", head: true }),
    context.supabase.from("articles").select("id", { count: "exact", head: true }),
  ]);

  const checks = {
    administratorSession: { ok: true, detail: "Authenticated administrator session verified." },
    supabaseUrl: { ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), detail: "Supabase URL environment variable." },
    supabaseAnonKey: { ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), detail: "Supabase public client key environment variable." },
    adminEmail: { ok: Boolean(process.env.ADMIN_EMAIL), detail: "Administrator allow-list environment variable." },
    siteUrl: {
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL) && configuredSiteHost() !== "invalid-url",
      detail: configuredSiteHost() ?? "NEXT_PUBLIC_SITE_URL is not configured.",
      host: configuredSiteHost(),
    },
    issuesDatabase: { ok: !issues.error, count: issues.count ?? null, detail: issues.error ? "Issues table query failed." : "Issues table reachable." },
    articlesDatabase: { ok: !articles.error, count: articles.count ?? null, detail: articles.error ? "Articles table query failed." : "Articles table reachable." },
  };

  const ok = Object.values(checks).every((check) => check.ok);
  return NextResponse.json({
    ok,
    checkedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? "unknown",
    deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    deploymentHost: process.env.VERCEL_URL ?? null,
    checks,
  }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
