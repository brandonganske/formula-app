// Tool credit costs (mirror of the backend CREDIT_COST) + the one check every
// tool screen does on failure: was it a 402 / INSUFFICIENT_CREDITS?
export const TOOL_COST = {
  shopSafeScript: 0,
  shopSafeVideo: 1,
  breakdown: 1,
  coach: 0,
} as const;

export function isInsufficientCredits(err: any): boolean {
  const status = err?.response?.status;
  const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
  return status === 402 || code === 'INSUFFICIENT_CREDITS';
}

import { usesLabel } from '@/lib/iap/catalog';
export const creditLabel = usesLabel;

export function isFairUse(err: any): boolean {
  const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
  return err?.response?.status === 429 || code === 'FAIR_USE_REACHED';
}
