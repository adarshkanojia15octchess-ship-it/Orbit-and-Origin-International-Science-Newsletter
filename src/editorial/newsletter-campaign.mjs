import { createHmac } from "node:crypto";

export function escapeCampaignHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export function buildCampaignIdempotencyKey(campaignId, deliveryId) {
  return "issue-campaign/" + campaignId + "/" + deliveryId;
}

export function buildTestIdempotencyKey(campaignId, recipientHash, contentHash) {
  return "campaign-test/" + campaignId + "/" + recipientHash + "/" + contentHash;
}

export function buildUnsubscribeToken(subscriberId, secret) {
  if (!subscriberId || !secret) throw new Error("Unsubscribe token configuration is missing.");
  return createHmac("sha256", secret).update(subscriberId).digest("hex");
}

export function getResendRetryDelaySeconds(attemptCount) {
  const attempt = Math.max(1, Math.floor(Number(attemptCount) || 1));
  return Math.min(900, 60 * (2 ** (attempt - 1)));
}

export function isRetryableResendError(error) {
  const status = Number(error?.statusCode ?? error?.status ?? 0);
  return !status || status === 429 || status >= 500;
}

function paragraphs(text) {
  return String(text || "").trim().split(/\n\s*\n/).filter(Boolean)
    .map((paragraph) => '<p style="margin:0 0 18px;line-height:1.8;color:#26384A">' +
      escapeCampaignHtml(paragraph).replace(/\n/g, "<br>") + "</p>")
    .join("");
}

export function buildCampaignEmail({
  firstName = "", preheader = "", messageText = "", issueTitle = "",
  issueDescription = "", issueNumber, issueUrl, unsubscribeUrl = "", testMode = false,
}) {
  const safeName = escapeCampaignHtml(String(firstName).trim());
  const greeting = safeName ? "Hello " + safeName + "," : "Hello,";
  const safeTitle = escapeCampaignHtml(issueTitle);
  const safePreheader = escapeCampaignHtml(preheader || "A new ORBIT & ORIGIN edition is ready to explore.");
  const safeIssueNumber = String(issueNumber ?? "").padStart(3, "0");
  const safeIssueDescription = escapeCampaignHtml(issueDescription);
  const safeIssueUrl = escapeCampaignHtml(issueUrl);
  const body = paragraphs(messageText);
  const testBanner = testMode
    ? '<p style="margin:0 0 18px;padding:10px 12px;background:#F7EEDB;color:#785A2B;font-size:12px;letter-spacing:1px;text-transform:uppercase">Test preview — this message was not sent to subscribers</p>'
    : "";
  const unsubscribe = unsubscribeUrl
    ? '<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #DCE3E8;color:#6C7B88;font-size:11px;line-height:1.7">You are receiving this because you confirmed an ORBIT &amp; ORIGIN subscription. <a href="' +
      escapeCampaignHtml(unsubscribeUrl) + '" style="color:#765A2C">Unsubscribe</a>.</p>'
    : "";

  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    safeTitle + '</title></head><body style="margin:0;padding:30px 12px;background:#EEF1F3;font-family:Arial,Helvetica,sans-serif;color:#13283D">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + safePreheader + '</div>' +
    '<main style="max-width:620px;margin:0 auto;padding:34px 32px;background:#FAF8F2;border:1px solid #DCE2E6">' +
    '<p style="margin:0 0 30px;color:#8B6E42;font-family:Georgia,serif;font-size:15px;letter-spacing:3px">ORBIT &amp; ORIGIN</p>' +
    testBanner +
    '<p style="margin:0 0 10px;color:#8B6E42;font-size:10px;letter-spacing:2px;text-transform:uppercase">ISSUE ' + escapeCampaignHtml(safeIssueNumber) + '</p>' +
    '<h1 style="margin:0 0 20px;color:#12283D;font-family:Georgia,serif;font-size:34px;font-weight:normal;line-height:1.15">' + safeTitle + '</h1>' +
    '<p style="margin:0 0 20px;color:#26384A;line-height:1.8">' + greeting + '</p>' +
    body +
    '<div style="margin:24px 0;padding:22px;background:#E8EDF0"><p style="margin:0 0 10px;color:#8B6E42;font-size:10px;letter-spacing:2px">THE LATEST EDITION</p>' +
    '<h2 style="margin:0 0 10px;color:#12283D;font-family:Georgia,serif;font-size:23px;font-weight:normal">' + safeTitle + '</h2>' +
    '<p style="margin:0;color:#586B7B;font-size:13px;line-height:1.7">' + safeIssueDescription + '</p>' +
    '<a href="' + safeIssueUrl + '" style="display:inline-block;margin-top:18px;padding:13px 18px;background:#10283E;color:#FAF8F2;text-decoration:none;font-size:11px;letter-spacing:1px;text-transform:uppercase">Read the edition ↗</a></div>' +
    '<p style="margin:28px 0 0;color:#46596A;font-family:Georgia,serif;font-size:16px">Stay curious. Keep looking up.</p>' +
    '<p style="margin:8px 0 0;color:#71808D;font-size:11px">The ORBIT &amp; ORIGIN Editorial Desk</p>' +
    unsubscribe + "</main></body></html>";

  const text = [
    "ORBIT & ORIGIN",
    testMode ? "TEST PREVIEW — not sent to subscribers" : "",
    "ISSUE " + safeIssueNumber + ": " + issueTitle,
    greeting,
    String(messageText || "").trim(),
    issueDescription,
    "Read the edition: " + issueUrl,
    unsubscribeUrl ? "Unsubscribe: " + unsubscribeUrl : "",
    "Stay curious. Keep looking up.",
  ].filter(Boolean).join("\n\n");

  return { html, text };
}
