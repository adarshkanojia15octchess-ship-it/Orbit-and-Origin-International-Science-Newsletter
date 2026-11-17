import { NextResponse } from "next/server";

export async function fetchJson(
  url: string,
  revalidateSeconds: number,
  extraHeaders: HeadersInit = {},
): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...extraHeaders },
    next: { revalidate: revalidateSeconds },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error("Science provider returned HTTP " + response.status);
  }
  return response.json();
}

export async function fetchText(
  url: string,
  revalidateSeconds: number,
  extraHeaders: HeadersInit = {},
): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/atom+xml, application/xml, text/xml, */*", ...extraHeaders },
    next: { revalidate: revalidateSeconds },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error("Science provider returned HTTP " + response.status);
  }
  return response.text();
}

export function providerFailure(provider: string, error: unknown) {
  console.error(
    "[science-observatory:" + provider + "]",
    error instanceof Error ? error.message : "Unknown upstream error",
  );
  return NextResponse.json(
    {
      error: provider + " data is temporarily unavailable. Please try again later.",
      provider,
    },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export function safeExternalUrl(value: unknown, allowedHosts?: string[]): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (allowedHosts && !allowedHosts.includes(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function stripMarkup(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
