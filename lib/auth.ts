import { Platform } from 'react-native';
import axios from 'axios';
import { AuthTokens } from '@/types/api';
import { storage } from './storage';

const PROXY_URL = 'https://xrxnpetqsqwsxfbsgybu.supabase.co/functions/v1/iq-proxy';
const DIRECT_URL = 'https://iq.influenceish.com/api/v1';
const BASE_URL = Platform.OS === 'web' ? PROXY_URL : DIRECT_URL;

export const TOKEN_KEY = 'iq_access_token';
export const REFRESH_KEY = 'iq_refresh_token';
export const EXPIRES_KEY = 'iq_expires_at';

export function isValidRefreshToken(token: string | null | undefined): boolean {
  if (!token) return false;
  if (token === 'undefined' || token === 'null') return false;
  if (token.length <= 10) return false;
  return true;
}

async function storeTokens(tokens: AuthTokens): Promise<void> {
  if (tokens.access_token && typeof tokens.access_token === 'string') {
    await storage.setItem(TOKEN_KEY, tokens.access_token);
  }
  if (isValidRefreshToken(tokens.refresh_token)) {
    await storage.setItem(REFRESH_KEY, tokens.refresh_token);
  } else {
    await storage.removeItem(REFRESH_KEY);
  }
  if (tokens.expires_at && typeof tokens.expires_at === 'string') {
    await storage.setItem(EXPIRES_KEY, tokens.expires_at);
  }
}

export async function login(
  email: string,
  password: string,
): Promise<{ tokens: AuthTokens | null; error: string | null }> {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/auth/login`,
      { email, password },
      { headers: { 'x-app-source': 'mobile_app' } },
    );
    const tokens: AuthTokens = {
      access_token: String(data.access_token ?? ''),
      refresh_token: String(data.refresh_token ?? ''),
      expires_at: String(data.expires_at ?? ''),
    };
    await storeTokens(tokens);
    return { tokens, error: null };
  } catch (err: any) {
    if (!err?.response) {
      return { tokens: null, error: err?.message ?? 'Network error — check your connection' };
    }
    const body = err.response.data ?? {};
    const msg =
      body?.error?.message ||
      (typeof body?.error === 'string' ? body.error : null) ||
      body?.message ||
      'Login failed';
    return { tokens: null, error: typeof msg === 'string' ? msg : 'Login failed' };
  }
}

// TikTok OAuth: the in-app browser flow hands us a one-time `code`; the backend
// exchanges it for the same token payload /auth/login returns, so persistence
// is identical to a password login.
export async function loginWithTikTokCode(
  code: string,
): Promise<{ tokens: AuthTokens | null; error: string | null }> {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/auth/tiktok-exchange`,
      { code },
      { headers: { 'x-app-source': 'mobile_app' } },
    );
    const tokens: AuthTokens = {
      access_token: String(data.access_token ?? ''),
      refresh_token: String(data.refresh_token ?? ''),
      expires_at: String(data.expires_at ?? ''),
    };
    await storeTokens(tokens);
    return { tokens, error: null };
  } catch (err: any) {
    if (!err?.response) {
      return { tokens: null, error: err?.message ?? 'Network error — check your connection' };
    }
    const body = err.response.data ?? {};
    const msg =
      body?.error?.message ||
      (typeof body?.error === 'string' ? body.error : null) ||
      body?.message ||
      'TikTok sign-in failed';
    return { tokens: null, error: typeof msg === 'string' ? msg : 'TikTok sign-in failed' };
  }
}

export async function register(
  handle: string,
  email: string,
  password: string,
): Promise<{ tokens: AuthTokens | null; error: string | null }> {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/auth/register`,
      { handle, email, password, source: 'mobile_app' },
      { headers: { 'x-app-source': 'mobile_app' } },
    );
    const access_token: string = data.access_token ?? data.token;
    if (!access_token) throw new Error('No token in registration response');
    const tokens: AuthTokens = {
      access_token: String(access_token),
      refresh_token: String(data.refresh_token ?? ''),
      expires_at: String(data.expires_at ?? ''),
    };
    await storeTokens(tokens);
    return { tokens, error: null };
  } catch (err: any) {
    const body = err?.response?.data ?? {};
    const msg =
      body?.error?.message ||
      (typeof body?.error === 'string' ? body.error : null) ||
      body?.message ||
      'Registration failed';
    return { tokens: null, error: msg };
  }
}

export async function doTokenRefresh(): Promise<AuthTokens> {
  const refreshToken = await storage.getItem(REFRESH_KEY);
  if (!isValidRefreshToken(refreshToken)) {
    await clearTokens();
    throw new Error('No valid refresh token');
  }
  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
  const tokens: AuthTokens = {
    access_token: String(data.access_token ?? ''),
    refresh_token: String(data.refresh_token ?? refreshToken!),
    expires_at: String(data.expires_at ?? ''),
  };
  await storeTokens(tokens);
  return tokens;
}

export async function clearTokens(): Promise<void> {
  await storage.removeItem(TOKEN_KEY);
  await storage.removeItem(REFRESH_KEY);
  await storage.removeItem(EXPIRES_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return storage.getItem(TOKEN_KEY);
}

// The access token is a Supabase JWT; its `sub` claim is the auth user id that
// the IQ API authenticates with. RevenueCat's app_user_id MUST be set to this
// exact value so the purchase webhook can resolve the buyer to their creator.
export async function getAuthUserId(): Promise<string | null> {
  const token = await storage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    let b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = typeof atob === 'function' ? atob(b64) : '';
    const payload = JSON.parse(json);
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function loadStoredAuth(): Promise<boolean> {
  const token = await storage.getItem(TOKEN_KEY);
  return !!token;
}
