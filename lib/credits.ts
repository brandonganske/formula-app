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

export const creditLabel = (n: number) => (n === 0 ? 'Free' : `${n} credit${n === 1 ? '' : 's'}`);
