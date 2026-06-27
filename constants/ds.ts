import { Platform, Easing } from 'react-native';

// Shared motion curves. `out` is a strong ease-out for entrances/fills (starts
// fast — the moment the user is watching). `inOut` for on-screen morphs.
// `linear` for progress/continuous motion.
export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  linear: Easing.linear,
};

// Formula design tokens — coral + lime on ink/paper

export const D = {
  // ── Canvases ──────────────────────────────────────────────────────────────
  bg: '#F4F3EF',
  paper: '#F4F3EF',
  bgElevated: '#FAFAF8',
  card: '#FFFFFF',
  cardBorder: 'rgba(26,20,38,0.10)',
  cardHover: '#FAFAF8',

  // Surfaces
  surface: '#F7F6F2',
  surfaceBorder: 'rgba(26,20,38,0.08)',
  surfaceHover: '#F2F1EC',

  // ── Core accent ───────────────────────────────────────────────────────────
  coral: '#FF3755',
  coralWarm: '#FF5E3A',
  coralSubtle: 'rgba(255,55,85,0.08)',
  coralFaint: 'rgba(255,55,85,0.05)',
  coralGlow: 'rgba(255,55,85,0.30)',

  // ── Lime highlight ────────────────────────────────────────────────────────
  lime: '#B6FF8A',
  limeDeep: '#2FA10C',
  limeSubtle: 'rgba(182,255,138,0.25)',

  // ── Ink system ────────────────────────────────────────────────────────────
  ink: '#1A1426',
  inkSoft: 'rgba(26,20,38,0.62)',
  inkFaint: 'rgba(26,20,38,0.42)',
  inkLine: 'rgba(26,20,38,0.10)',
  inkHairline: 'rgba(26,20,38,0.06)',

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary: '#1A1426',
  textSecondary: 'rgba(26,20,38,0.62)',
  textMuted: 'rgba(26,20,38,0.42)',
  textDisabled: 'rgba(26,20,38,0.28)',

  // ── Borders / dividers ────────────────────────────────────────────────────
  border: 'rgba(26,20,38,0.10)',
  borderSubtle: 'rgba(26,20,38,0.06)',
  borderFocus: 'rgba(255,55,85,0.45)',
  divider: 'rgba(26,20,38,0.06)',

  // ── Dark card (hero moments) ──────────────────────────────────────────────
  inkCard: '#1A1426',
  inkCardBorder: 'rgba(255,255,255,0.08)',
  inkCardText: 'rgba(255,255,255,0.60)',

  // ── Semantic ──────────────────────────────────────────────────────────────
  success: '#2FA10C',
  successSubtle: 'rgba(47,161,12,0.10)',
  successBorder: 'rgba(47,161,12,0.22)',

  warning: '#F59E0B',
  warningSubtle: 'rgba(245,158,11,0.10)',

  error: '#E63946',
  errorSubtle: 'rgba(230,57,70,0.08)',
  errorBorder: 'rgba(230,57,70,0.20)',

  // ── Secondary chip colors ─────────────────────────────────────────────────
  cyan: '#06b6d4',
  cyanSubtle: 'rgba(6,182,212,0.10)',

  pink: '#ec4899',
  pinkSubtle: 'rgba(236,72,153,0.10)',

  amber: '#F59E0B',
  amberSubtle: 'rgba(245,158,11,0.10)',

  green: '#2FA10C',
  greenSubtle: 'rgba(47,161,12,0.10)',

  // ── Legacy aliases — keep so screens compile unchanged ────────────────────
  purple: '#FF3755',
  purpleLight: '#FF6680',
  purpleDim: '#FF6680',
  purpleSubtle: 'rgba(255,55,85,0.08)',
  purpleFaint: 'rgba(255,55,85,0.05)',
  purpleGlow: 'rgba(255,55,85,0.22)',
};

const _family = Platform.select({
  android: 'Roboto',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  default: undefined,
}) as string | undefined;

export const T = {
  regular: _family ? { fontFamily: _family, fontWeight: '400' as const } : { fontWeight: '400' as const },
  medium:  _family ? { fontFamily: _family, fontWeight: '500' as const } : { fontWeight: '500' as const },
  bold:    _family ? { fontFamily: _family, fontWeight: '600' as const } : { fontWeight: '600' as const },
};

// Max content width. Phones are narrower than this so it's a no-op there; on
// tablets it caps the app to a centered, phone-width column (the page bg shows
// in the side gutters) instead of stretching every layout edge-to-edge.
export const MAX_CONTENT = 600;

export const R = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 999,
};

export const Shadow = {
  soft: {
    shadowColor: '#1A1426',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    shadowColor: '#1A1426',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  coral: {
    shadowColor: '#FF3755',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
};
