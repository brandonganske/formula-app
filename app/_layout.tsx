import { useEffect } from 'react';
import { Stack, SplashScreen, useRouter } from 'expo-router';
import React from 'react';

// expo-share-intent is native and only exists in builds made after the share
// extension was added. Older dev clients get a no-op provider instead of a crash.
let ShareIntentProvider: React.ComponentType<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
let useShareIntentContext: () => { hasShareIntent: boolean; shareIntent: any; resetShareIntent: () => void } =
  () => ({ hasShareIntent: false, shareIntent: null, resetShareIntent: () => {} });
try {
  const mod = require('expo-share-intent');
  if (mod?.ShareIntentProvider && mod?.useShareIntentContext) { ShareIntentProvider = mod.ShareIntentProvider; useShareIntentContext = mod.useShareIntentContext; }
} catch {}
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PurchasesProvider } from '@/context/PurchasesContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RootLayoutNav() {
  const { isLoading, isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);
  const router = useRouter();

  // Links shared from TikTok's share sheet land here; hand them to /share
  // where the creator picks rewrite / breakdown / recreate / Shop Safe.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (isLoading || !hasShareIntent) return;
    const raw = shareIntent?.webUrl ?? shareIntent?.text ?? '';
    const m = String(raw).match(/https?:\/\/[^\s]+/);
    resetShareIntent();
    if (!m) return;
    if (!isAuthenticated) { router.replace('/'); return; }
    router.push({ pathname: '/share', params: { url: m[0] } });
  }, [hasShareIntent, isLoading, isAuthenticated]);

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#F4F3EF' }} />;
  }

  return (
    <Stack screenOptions={{
      headerShown: false, animation: 'fade',
      gestureEnabled: true, fullScreenGestureEnabled: true,
      contentStyle: { backgroundColor: '#F4F3EF' },
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="reset-password" />
      {/* Onboarding + tabs shouldn't be swipe-dismissable back to a prior screen. */}
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="create-brain" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="script/[id]" options={{ animation: 'slide_from_right', fullScreenGestureEnabled: true }} />
      {/* Design-preview route (no auth guard) — /shop-preview on web */}
      <Stack.Screen name="shop-preview" />
      <Stack.Screen name="shop-safe" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="teleprompter" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="tools/sample-pitch" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="tools/objections" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="tools/coach" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="tools/breakdown" options={{ animation: 'slide_from_bottom' }} />
      {/* TikTok native-login Universal Link return target */}
      <Stack.Screen name="tiktok/native" />
      <Stack.Screen name="share" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="tour" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ShareIntentProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F4F3EF' }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PurchasesProvider>
            <RootLayoutNav />
            <StatusBar style="dark" />
          </PurchasesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
