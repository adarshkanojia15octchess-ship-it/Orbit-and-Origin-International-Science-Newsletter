export type CampaignEmailInput = {
  firstName?: string;
  preheader?: string;
  messageText?: string;
  issueTitle?: string;
  issueDescription?: string;
  issueNumber?: number | string;
  issueUrl: string;
  unsubscribeUrl?: string;
  testMode?: boolean;
};
export function escapeCampaignHtml(value?: string): string;
export function buildCampaignIdempotencyKey(campaignId: string, deliveryId: string): string;
export function buildTestIdempotencyKey(campaignId: string, recipientHash: string, contentHash: string): string;
export function buildUnsubscribeToken(subscriberId: string, secret: string): string;
export function getResendRetryDelaySeconds(attemptCount: number): number;
export function isRetryableResendError(error: unknown): boolean;
export function buildCampaignEmail(input: CampaignEmailInput): { html: string; text: string };
