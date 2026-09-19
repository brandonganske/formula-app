import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// One place for taptics so every screen speaks the same physical language:
//   tap      — a button did something (light impact)
//   press    — a primary action fired (medium impact)
//   select   — a choice changed: segment, tab, toggle, picker row
//   success  — something saved / finished
//   warning  — something needs attention (a C/D grade, a soft block)
//   error    — something failed
// Every call is a no-op on web and swallows "haptics unavailable".
const run = (fn: () => Promise<void>) => { if (Platform.OS === 'web') return; try { void fn().catch(() => {}); } catch {} };

export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  select: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
