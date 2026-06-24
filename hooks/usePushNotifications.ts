import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

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
  const responseSub = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerAndStoreToken();

    responseSub.current = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate('/(tabs)');
    });

    return () => {
      responseSub.current?.remove();
    };
  }, [isAuthenticated]);
}
