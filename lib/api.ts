import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { getAccessToken, doTokenRefresh, clearTokens } from './auth';

const PROXY_URL = 'https://xrxnpetqsqwsxfbsgybu.supabase.co/functions/v1/iq-proxy';
const DIRECT_URL = 'https://iq.influenceish.com/api/v1';
const BASE_URL = Platform.OS === 'web' ? PROXY_URL : DIRECT_URL;

// Global session-expired callback — AuthContext subscribes to this
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,
});

// ── Inject bearer token + app source on every request ────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken();
  if (config.headers) {
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    config.headers['x-app-source'] = 'mobile_app';
  }
  return config;
});

// ── Auth-refresh queue ─────────────────────────────────────────────────────
let isRefreshing = false;
let failQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  failQueue = [];
}

// Statuses that warrant a client-side retry with backoff (transient server / AI overload)
const RETRY_STATUSES = new Set([429, 502, 503, 529]);
const RETRY_DELAYS_MS = [8_000, 20_000]; // two extra attempts: wait 8s then 20s

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Returns true when the error message indicates the AI provider is temporarily overwhelmed
function isAiOverloadMessage(error: AxiosError): boolean {
  const msg: string =
    (error.response?.data as any)?.error?.message ??
    (error.response?.data as any)?.message ??
    '';
  return (
    msg.toLowerCase().includes('high demand') ||
    msg.toLowerCase().includes('overloaded') ||
    msg.toLowerCase().includes('capacity')
  );
}

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _clientRetries?: number;
};

// ── Response interceptor: handles 401 auth refresh + transient retries ─────
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig;
    if (!original) return Promise.reject(error);

    const status = error.response?.status;

    // ── 401: refresh token once then retry ──────────────────────────────────
    if (status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failQueue.push({ resolve, reject });
        }).then((token) => {
          if (original.headers) original.headers['Authorization'] = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const tokens = await doTokenRefresh();
        processQueue(null, tokens.access_token);
        if (original.headers)
          original.headers['Authorization'] = `Bearer ${tokens.access_token}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearTokens();
        onSessionExpired?.();
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    // ── Transient errors: back-off and retry up to 2 extra times ────────────
    const retries = original._clientRetries ?? 0;
    if (
      retries < RETRY_DELAYS_MS.length &&
      (RETRY_STATUSES.has(status ?? 0) || isAiOverloadMessage(error))
    ) {
      original._clientRetries = retries + 1;
      await sleep(RETRY_DELAYS_MS[retries]);
      return api(original);
    }

    // Humanise the AI-overload message so the user sees something actionable
    if (isAiOverloadMessage(error) || RETRY_STATUSES.has(status ?? 0)) {
      const wrapped = new Error(
        'The AI is temporarily overloaded — please try again in a moment.',
      );
      (wrapped as any).originalError = error;
      return Promise.reject(wrapped);
    }

    return Promise.reject(error);
  },
);

// ── Unwrap { success, data } envelope used by all /creators/* endpoints ────
export function extractData<T>(response: { data: any }): T {
  return response.data?.data ?? response.data;
}
