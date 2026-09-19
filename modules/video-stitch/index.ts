import { Platform } from 'react-native';

// Joins clips recorded back-to-back into one file. Native (iOS only); older
// builds without the module get `null` so callers can fall back.
export async function stitchVideos(uris: string[]): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  if (uris.length === 1) return uris[0];
  try {
    const { requireNativeModule } = require('expo-modules-core');
    const mod: any = requireNativeModule('VideoStitch');
    const out: string = await mod.stitch(uris);
    return out || null;
  } catch {
    return null;
  }
}

export function isStitchAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try { const { requireNativeModule } = require('expo-modules-core'); requireNativeModule('VideoStitch'); return true; } catch { return false; }
}
