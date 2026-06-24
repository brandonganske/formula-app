import React, { useEffect, useRef } from 'react';
import { Animated, Easing, AccessibilityInfo, ViewStyle, StyleProp } from 'react-native';

// Strong ease-out — entering elements start fast so the moment the user is
// watching isn't delayed. (Built-in easings are too weak; RN's Animated default
// is Easing.inOut, which adds an ease-in ramp we don't want on entrances.)
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// App-wide reduced-motion flag. Queried once at import and kept current via a
// single listener, so component mounts can read it synchronously (no flash).
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; }).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'none';
  slideDistance?: number;
};

export default function FadeInView({
  children,
  style,
  delay = 0,
  duration = 260,
  direction = 'down',
  slideDistance = 18,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(direction === 'down' ? -slideDistance : direction === 'up' ? slideDistance : 0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      const anims = [
        Animated.timing(opacity, { toValue: 1, duration, easing: EASE_OUT, useNativeDriver: true }),
      ];
      // Reduced motion keeps the opacity fade (gentler, not zero) but drops the
      // movement entirely.
      if (direction !== 'none' && !reduceMotion) {
        anims.push(Animated.timing(translate, { toValue: 0, duration, easing: EASE_OUT, useNativeDriver: true }));
      } else {
        translate.setValue(0);
      }
      Animated.parallel(anims).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animStyle: any = { opacity };
  if (direction !== 'none') {
    animStyle.transform = [{ translateY: translate }];
  }

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  );
}
