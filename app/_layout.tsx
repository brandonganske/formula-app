import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
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
      {/* TikTok native-login Universal Link return target */}
      <Stack.Screen name="tiktok/native" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
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
  );
}
