import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { getAuthUserId } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { ALL_PRODUCT_IDS } from '@/lib/iap/catalog';

// react-native-purchases has no native module inside Expo Go — guard so the app
// still runs there. IAP only works in a dev/standalone build.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const RC_API_KEY = (Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
}) ?? undefined) as string | undefined;

// Lazy-require so importing this file never touches the native module in Expo Go.
let Purchases: any = null;
let RevenueCatUI: any = null;
if (!isExpoGo) {
  try { Purchases = require('react-native-purchases').default; } catch { Purchases = null; }
  try { RevenueCatUI = require('react-native-purchases-ui').default; } catch { RevenueCatUI = null; }
}

type Pkg = any; // PurchasesPackage

export interface PurchaseResult { ok: boolean; cancelled?: boolean; error?: string }

interface PurchasesContextType {
  /** True only in a real build with a configured RC key — UI gates on this. */
  available: boolean;
  /** Offerings fetched and SDK configured. */
  ready: boolean;
  /** productId -> localized price string (from the store). */
  priceById: Record<string, string>;
  /** Buy a product by its store product ID. */
  purchase: (productId: string) => Promise<PurchaseResult>;
  /** Restore prior purchases (Apple requires this button). */
  restore: () => Promise<PurchaseResult>;
  /** Open RevenueCat's Customer Center (manage / cancel / restore). */
  openCustomerCenter: () => Promise<void>;
  /** Re-pull offerings (e.g. after products are registered). */
  refreshOfferings: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextType | undefined>(undefined);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, refreshMe } = useAuth();
  const available = !isExpoGo && !!Purchases && !!RC_API_KEY;

  const [ready, setReady] = useState(false);
  const [priceById, setPriceById] = useState<Record<string, string>>({});
  const packagesRef = useRef<Record<string, Pkg>>({});
  const configuredRef = useRef(false);

  const loadOfferings = useCallback(async () => {
    if (!available) return;
    try {
      const offerings = await Purchases.getOfferings();
      const map: Record<string, Pkg> = {};
      const prices: Record<string, string> = {};
      const all = offerings?.all ? Object.values(offerings.all) : [];
      for (const off of all as any[]) {
        for (const pkg of off?.availablePackages ?? []) {
          const pid = pkg?.product?.identifier;
          if (!pid) continue;
          map[pid] = pkg;
          if (pkg?.product?.priceString) prices[pid] = pkg.product.priceString;
        }
      }
      packagesRef.current = map;
      setPriceById(prices);
    } catch (err) {
      console.warn('[Purchases] getOfferings failed:', (err as any)?.message);
    }
  }, [available]);

  // Configure the SDK once.
  useEffect(() => {
    if (!available || configuredRef.current) return;
    configuredRef.current = true;
    try {
      Purchases.configure({ apiKey: RC_API_KEY });
      loadOfferings().finally(() => setReady(true));
    } catch (err) {
      console.warn('[Purchases] configure failed:', (err as any)?.message);
    }
  }, [available, loadOfferings]);

  // Identify the user to RevenueCat with the auth `sub` so the webhook can
  // resolve purchases to the creator. Re-runs whenever auth flips.
  useEffect(() => {
    if (!available) return;
    (async () => {
      try {
        if (isAuthenticated) {
          const uid = await getAuthUserId();
          if (uid) await Purchases.logIn(uid);
        } else {
          await Purchases.logOut();
        }
      } catch (err) {
        console.warn('[Purchases] identify failed:', (err as any)?.message);
      }
    })();
  }, [available, isAuthenticated]);

  // After a purchase the grant is async (RC -> our webhook -> credits). Poll
  // the balance a few times so the UI reflects it without a manual refresh.
  const pollBalance = useCallback(async () => {
    for (let i = 0; i < 4; i++) {
      await refreshMe();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }, [refreshMe]);

  const purchase = useCallback(async (productId: string): Promise<PurchaseResult> => {
    if (!available) return { ok: false, error: 'Purchases require the app build (not available in Expo Go).' };
    const pkg = packagesRef.current[productId];
    if (!pkg) return { ok: false, error: 'This product isn’t available yet. Please try again shortly.' };
    try {
      await Purchases.purchasePackage(pkg);
      pollBalance();
      return { ok: true };
    } catch (err: any) {
      if (err?.userCancelled) return { ok: false, cancelled: true };
      return { ok: false, error: err?.message ?? 'Purchase failed. Please try again.' };
    }
  }, [available, pollBalance]);

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    if (!available) return { ok: false, error: 'Restoring requires the app build (not available in Expo Go).' };
    try {
      await Purchases.restorePurchases();
      pollBalance();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Could not restore purchases.' };
    }
  }, [available, pollBalance]);

  const openCustomerCenter = useCallback(async () => {
    if (!available || !RevenueCatUI?.presentCustomerCenter) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
      // The user may have canceled/restored inside the center — refresh to reflect it.
      refreshMe();
    } catch (err) {
      console.warn('[Purchases] customer center failed:', (err as any)?.message);
    }
  }, [available, refreshMe]);

  return (
    <PurchasesContext.Provider value={{ available, ready, priceById, purchase, restore, openCustomerCenter, refreshOfferings: loadOfferings }}>
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider');
  return ctx;
}

// Exposed so screens can hint why IAP is unavailable.
export const purchasesEnvInfo = { isExpoGo, hasKey: !!RC_API_KEY };
// Referenced to keep the catalog import meaningful for future offering validation.
export const KNOWN_PRODUCT_IDS = ALL_PRODUCT_IDS;
