import { NativeModule, requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type TikTokAuthResult =
  | {
      isSuccess: true;
      /** TikTok authorization code — exchange server-side. */
      code: string;
      /** PKCE verifier the SDK generated; REQUIRED for the token exchange. */
      codeVerifier: string;
      grantedPermissions?: string[];
      state?: string;
    }
  | {
      isSuccess: false;
      errorCode: number;
      errorMsg: string;
    };

interface TikTokLoginNativeModule extends NativeModule {
  isTikTokAppInstalled(): boolean;
  authenticate(scopes: string[], redirectURI: string): Promise<TikTokAuthResult>;
  handleReturnURL(url: string): boolean;
}

let nativeModule: TikTokLoginNativeModule | null = null;
if (Platform.OS === 'ios') {
  try {
    nativeModule = requireNativeModule<TikTokLoginNativeModule>('TikTokLogin');
  } catch {
    // Native module absent (e.g. Expo Go / Android) — callers fall back to web.
    nativeModule = null;
  }
}

/** True only when the native TikTok SDK is linked (iOS dev/release build). */
export function isNativeTikTokAvailable(): boolean {
  return nativeModule != null;
}

/** Best-effort: whether the TikTok app is installed (for app-to-app). */
export function isTikTokAppInstalled(): boolean {
  try {
    return nativeModule?.isTikTokAppInstalled() ?? false;
  } catch {
    return false;
  }
}

/**
 * Hand a TikTok return URL to the SDK from JS (a guaranteed path alongside the
 * native AppDelegate hook). Returns true if the SDK consumed it. No-op (false)
 * when the native module isn't linked.
 */
export function handleReturnURL(url: string): boolean {
  try {
    return nativeModule?.handleReturnURL(url) ?? false;
  } catch {
    return false;
  }
}

/**
 * Open TikTok (app-to-app, or TikTok's in-app web-view if not installed) and
 * return the authorization code + PKCE verifier. Throws if the native module
 * isn't linked — callers should catch and fall back to the web OAuth flow.
 */
export async function authenticate(
  scopes: string[],
  redirectURI: string,
): Promise<TikTokAuthResult> {
  if (!nativeModule) throw new Error('Native TikTok module unavailable');
  return nativeModule.authenticate(scopes, redirectURI);
}
