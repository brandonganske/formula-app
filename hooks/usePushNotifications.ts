import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerAndStoreToken() {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync();

  if (status !== 'granted') return;

  // getExpoPushTokenAsync needs the EAS projectId — it can't be inferred in
  // bare/dev contexts. Without it the call throws, so resolve it explicitly
  // and skip cleanly until an EAS project is configured.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  if (!projectId) {
    console.warn('[push] No EAS projectId — skipping push token registration. Run `eas init`.');
    return;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.patch('/creators/me', { push_token: token });
  } catch (err) {
    // non-critical — token will be retried next session
    console.warn('[push] token registration failed:', err);
  }
}

export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const qc = useQueryClient();
  const responseSub = useRef<Notifications.Subscription | null>(null);
  const receiveSub = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerAndStoreToken();

    // Tap on a push: follow its deep link (data.deepLink, a Formula route such
    // as /(tabs)/deals?seg=invites), else open the notifications list.
    responseSub.current = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = (r.notification.request.content.data ?? {}) as { deepLink?: string };
      const to = typeof data.deepLink === 'string' && data.deepLink.startsWith('/') ? data.deepLink : '/notifications';
      qc.invalidateQueries({ queryKey: ['notifications'] });
      router.navigate(to as any);
    });
    // Push while the app is open: refresh the bell badge.
    receiveSub.current = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      responseSub.current?.remove();
      receiveSub.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
}
