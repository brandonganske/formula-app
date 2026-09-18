import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image,
  Animated, ActivityIndicator, Platform, KeyboardAvoidingView, Switch, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { D, T, R, Shadow, Ease } from '@/constants/ds';
import { Check, ArrowRight, ArrowLeft, MapPin, Phone } from 'lucide-react-native';
import Svg, { Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import AnimatedPressable from '@/components/AnimatedPressable';
import { OnboardingPatch } from '@/types/api';
import { GENDER_OPTIONS, AGE_RANGE_OPTIONS, COUNTRIES } from '@/constants/onboarding';

// ─── Formula F mark ───────────────────────────────────────────────────────────

// Soft ambient glow across the top — a radial gradient that fades fully to
// transparent (no hard edge / circle).
function TopGlow() {
  return (
    <Svg style={glowS.svg} width="100%" height={300} pointerEvents="none">
      <Defs>
        <RadialGradient id="topGlow" cx="50%" cy="0%" rx="75%" ry="100%" fx="50%" fy="0%">
          <Stop offset="0%" stopColor={D.coral} stopOpacity={0.20} />
          <Stop offset="55%" stopColor={D.coral} stopOpacity={0.05} />
          <Stop offset="100%" stopColor={D.coral} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="300" fill="url(#topGlow)" />
    </Svg>
  );
}

function FormulaMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="22" y="16" width="16" height="68" rx="8" fill="#FFFFFF" />
      <Rect x="22" y="16" width="56" height="16" rx="8" fill="#B6FF8A" />
      <Rect x="22" y="44" width="42" height="15" rx="7.5" fill="#FFFFFF" />
    </Svg>
  );
}

// ─── Step model ───────────────────────────────────────────────────────────────

interface Option { label: string; value: string; sub?: string }
type StepKind = 'welcome' | 'options' | 'name' | 'country' | 'contact';
type Step = {
  id: string;
  kind: StepKind;
  field?: keyof OnboardingPatch;
  title: string;
  subtitle: string;
  options?: Option[];
};

// Shared with Settings (constants/onboarding.ts) so the two never drift.
const GENDER_OPTS: Option[] = GENDER_OPTIONS;
const AGE_OPTS: Option[] = AGE_RANGE_OPTIONS;

const OPTIN_CHANNELS: { key: 'whatsapp' | 'sms' | 'push' | 'email'; label: string; sub: string }[] = [
  { key: 'push', label: 'Push notifications', sub: 'When your creator brain is ready.' },
  { key: 'email', label: 'Email', sub: 'Tips, updates, and the occasional offer.' },
  { key: 'sms', label: 'Text messages', sub: 'Time-sensitive alerts via SMS.' },
  { key: 'whatsapp', label: 'WhatsApp', sub: 'Support and account updates.' },
];

// ─── Option card ──────────────────────────────────────────────────────────────

function OptionCard({
  option, selected, onPress,
}: { option: Option; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      style={[cardS.wrap, selected && cardS.wrapSelected]}
      onPress={onPress}
      haptic="light"
    >
      <Text style={[cardS.label, selected && cardS.labelSelected]}>{option.label}</Text>
      {option.sub ? <Text style={cardS.sub}>{option.sub}</Text> : null}
      <View style={[cardS.tick, selected && cardS.tickSelected]}>
        {selected && <Check size={13} color="#FFF" strokeWidth={3} />}
      </View>
    </AnimatedPressable>
  );
}

// ─── Animated step wrapper (slide + fade entrance) ─────────────────────────────

function StepView({ dir, children }: { dir: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(dir * 44)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 340, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(tx, { toValue: 0, duration: 380, easing: Ease.out, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: tx }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Avatar (TikTok picture, coral ring) ───────────────────────────────────────

function Avatar({ uri, fallback }: { uri?: string | null; fallback: string }) {
  const ring = useRef(new Animated.Value(0.9)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, easing: Ease.out, useNativeDriver: true }),
      Animated.spring(ring, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[avaS.wrap, { opacity: fade, transform: [{ scale: ring }] }]}>
      <View style={avaS.glow} />
      <View style={avaS.ring}>
        {uri ? (
          <Image source={{ uri }} style={avaS.img} />
        ) : (
          <View style={avaS.fallback}>
            <Text style={avaS.fallbackText}>{fallback}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, patchMe, refreshMe } = useAuth();

  const tiktokName = (profile?.display_name ?? '').trim();
  const handle = (profile?.handle ?? '').trim();
  const hasName = tiktokName.length > 0;
  const firstName = hasName ? tiktokName.split(/\s+/)[0] : (handle || 'there');
  const avatarUrl = profile?.avatar_url ?? null;
  const initials = (tiktokName || handle || 'F').slice(0, 1).toUpperCase();

  const steps: Step[] = useMemo(() => {
    const list: Step[] = [
      {
        id: 'welcome', kind: 'welcome',
        title: `Nice to meet you, ${firstName}.`,
        subtitle: 'Help us learn a little more about you so every script sounds authentically like you.',
      },
    ];
    if (!hasName) {
      list.push({
        id: 'name', kind: 'name', field: 'display_name',
        title: 'What should we call you?',
        subtitle: 'The name we\'ll use across the app.',
      });
    }
    list.push(
      {
        id: 'gender', kind: 'options', field: 'gender',
        title: 'A little about you.',
        subtitle: 'This helps us write in your authentic voice.',
        options: GENDER_OPTS,
      },
      {
        id: 'age', kind: 'options', field: 'age_range',
        title: 'Your age range.',
        subtitle: 'Tunes vocabulary and cultural references.',
        options: AGE_OPTS,
      },
      {
        id: 'country', kind: 'country', field: 'region',
        title: 'Where are you based?',
        subtitle: 'Filters trending content to your market.',
      },
      {
        id: 'contact', kind: 'contact',
        title: 'Stay in the loop.',
        subtitle: 'All optional — pick what you\'re comfortable with. We never share your info.',
      },
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasName, firstName]);

  const total = steps.length;
  const dataTotal = total - 1; // exclude the welcome hero from the progress count
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Partial<OnboardingPatch>>({});
  const [optins, setOptins] = useState({ whatsapp: false, sms: false, push: false, email: false });
  const set = (key: keyof OnboardingPatch, val: string) =>
    setAnswers((p) => ({ ...p, [key]: val || undefined }));

  const step = steps[index];
  const isWelcome = step.kind === 'welcome';
  const isLast = index === total - 1;

  // Animated progress bar over the DATA steps (welcome excluded).
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: isWelcome ? 0 : index / dataTotal,
      duration: 340, easing: Ease.out, useNativeDriver: false,
    }).start();
  }, [index, dataTotal, isWelcome]);

  const goNext = () => {
    setError(null);
    if (isLast) { finish(); return; }
    setDir(1);
    setIndex((i) => Math.min(i + 1, total - 1));
  };
  const goBack = () => {
    setError(null);
    setDir(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };

  const selectOption = (field: keyof OnboardingPatch, value: string) => {
    set(field, value);
    setTimeout(goNext, 230);
  };

  const finish = async () => {
    setSaving(true);
    setError(null);
    const patch: OnboardingPatch = { ...answers };
    patch.whatsapp_optin = optins.whatsapp;
    patch.sms_optin = optins.sms;
    patch.push_optin = optins.push;
    patch.email_optin = optins.email;
    patch.complete = true;
    const result = await patchMe(patch);
    if (result.error) { setSaving(false); setError(result.error); return; }
    await refreshMe();
    setSaving(false);
    // Straight into the Creator Brain build — the forced full-page step everyone
    // without a brain sees (also gated in app/index.tsx).
    router.replace('/create-brain');
  };

  const canContinue =
    step.kind === 'welcome' || step.kind === 'contact' ? true
    : step.kind === 'country' ? !!(answers.region && answers.region.trim())
    : step.kind === 'name' ? !!(answers.display_name && answers.display_name.trim())
    : !!answers[step.field as keyof OnboardingPatch];

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const ctaText = isWelcome ? 'Get started' : isLast ? 'Finish setup' : 'Continue';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={S.root}
    >
      <TopGlow />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerTop}>
          {index > 0 ? (
            <TouchableOpacity style={S.backBtn} onPress={goBack} hitSlop={12}>
              <ArrowLeft size={19} color={D.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          ) : <View style={S.backBtn} />}
          <View style={S.brandMark}><FormulaMark size={15} /></View>
          <Text style={S.counter}>{isWelcome ? '' : `${index}/${dataTotal}`}</Text>
        </View>
        {!isWelcome && (
          <View style={S.track}>
            <Animated.View style={[S.trackFill, { width: progressWidth }]} />
          </View>
        )}
      </View>

      {/* Body */}
      <View style={S.body}>
        <StepView key={step.id} dir={dir}>
          {isWelcome ? (
            <View style={S.welcome}>
              <Avatar uri={avatarUrl} fallback={initials} />
              {handle ? <Text style={S.welcomeHandle}>@{handle}</Text> : null}
              <Text style={S.welcomeTitle}>{step.title}</Text>
              <Text style={S.welcomeSub}>{step.subtitle}</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={S.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={S.title}>{step.title}</Text>
              <Text style={S.subtitle}>{step.subtitle}</Text>

              {step.kind === 'options' && (
                <View style={S.options}>
                  {step.options!.map((opt) => (
                    <OptionCard
                      key={opt.value}
                      option={opt}
                      selected={answers[step.field as keyof OnboardingPatch] === opt.value}
                      onPress={() => selectOption(step.field!, opt.value)}
                    />
                  ))}
                </View>
              )}

              {step.kind === 'name' && (
                <View style={S.inputRow}>
                  <TextInput
                    style={S.input}
                    placeholder="e.g. Alex Rivera"
                    placeholderTextColor={D.textDisabled}
                    value={answers.display_name ?? ''}
                    onChangeText={(v) => set('display_name', v)}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => canContinue && goNext()}
                    autoFocus
                  />
                </View>
              )}

              {step.kind === 'country' && (
                <View style={S.countryWrap}>
                  {COUNTRIES.map((c) => {
                    const sel = answers.region === c.name;
                    return (
                      <AnimatedPressable
                        key={c.name}
                        style={[S.countryChip, sel && S.countryChipSel]}
                        onPress={() => selectOption('region', c.name)}
                        haptic="light"
                      >
                        <Text style={S.countryFlag}>{c.flag}</Text>
                        <Text style={[S.countryName, sel && S.countryNameSel]}>{c.name}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}

              {step.kind === 'contact' && (
                <View>
                  <View style={S.inputRow}>
                    <Phone size={16} color={D.textMuted} strokeWidth={2} style={{ marginLeft: 14 }} />
                    <TextInput
                      style={S.input}
                      placeholder="Phone number (optional)"
                      placeholderTextColor={D.textDisabled}
                      value={answers.whatsapp ?? ''}
                      onChangeText={(v) => set('whatsapp', v)}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <Text style={S.consentLabel}>How can we reach you?</Text>
                  <View style={S.consentCard}>
                    {OPTIN_CHANNELS.map((c, i) => (
                      <View key={c.key} style={[S.consentRow, i > 0 && S.consentDivider]}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.consentName}>{c.label}</Text>
                          <Text style={S.consentSub}>{c.sub}</Text>
                        </View>
                        <Switch
                          value={optins[c.key]}
                          onValueChange={() => setOptins((p) => ({ ...p, [c.key]: !p[c.key] }))}
                          trackColor={{ false: D.border, true: D.coral }}
                          thumbColor="#FFF"
                          ios_backgroundColor={D.border}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {error && (
                <View style={S.errorBox}>
                  <Text style={S.errorText}>{error}</Text>
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </StepView>
      </View>

      {/* CTA — shown on everything except auto-advancing (options / country) steps */}
      {step.kind !== 'options' && step.kind !== 'country' && (
        <View style={S.footer}>
          <AnimatedPressable
            style={[S.cta, (!canContinue || saving) && S.ctaDisabled]}
            onPress={goNext}
            disabled={!canContinue || saving}
            haptic="medium"
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={S.ctaText}>{ctaText}</Text>
                <View style={S.ctaArrow}><ArrowRight size={15} color="#FFF" strokeWidth={2.5} /></View>
              </>
            )}
          </AnimatedPressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const glowS = StyleSheet.create({
  svg: { position: 'absolute', top: 0, left: 0, right: 0 },
});

const avaS = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  glow: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: D.coralGlow, opacity: 0.5,
  },
  ring: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 3, borderColor: D.coral,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.card, ...Shadow.coral,
  },
  img: { width: 96, height: 96, borderRadius: 48 },
  fallback: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center',
  },
  fallbackText: { ...T.bold, fontSize: 40, color: '#FFF' },
});

const cardS = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: D.card, borderRadius: R.lg,
    borderWidth: 1.5, borderColor: D.border,
    paddingVertical: 18, paddingHorizontal: 18,
  },
  wrapSelected: { borderColor: D.coral, backgroundColor: D.coralFaint },
  label: { ...T.medium, fontSize: 16, color: D.textSecondary, flex: 1 },
  labelSelected: { color: D.textPrimary },
  sub: { ...T.regular, fontSize: 12, color: D.textMuted, marginRight: 10 },
  tick: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center',
  },
  tickSelected: { backgroundColor: D.coral, borderColor: D.coral },
});

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  bgGlow: {
    position: 'absolute', top: -120, right: -90,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: D.coralGlow, opacity: 0.18,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 58,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  brandMark: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center', ...Shadow.coral,
  },
  counter: { ...T.medium, fontSize: 13, color: D.textMuted, width: 38, textAlign: 'right' },

  track: { height: 4, borderRadius: 2, backgroundColor: D.border, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: D.coral },

  body: { flex: 1 },

  // Welcome hero
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 },
  welcomeHandle: { ...T.medium, fontSize: 14, color: D.coral, marginBottom: 12, letterSpacing: 0.2 },
  welcomeTitle: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.9, lineHeight: 37, textAlign: 'center' },
  welcomeSub: { ...T.regular, fontSize: 15.5, color: D.textSecondary, marginTop: 14, lineHeight: 24, textAlign: 'center' },

  // Question steps
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  title: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.9, lineHeight: 37, marginTop: 18 },
  subtitle: { ...T.regular, fontSize: 15, color: D.textSecondary, marginTop: 10, lineHeight: 22, marginBottom: 30 },

  options: { gap: 12 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: D.card, borderRadius: R.lg,
    borderWidth: 1.5, borderColor: D.border,
  },
  input: {
    flex: 1, ...T.regular, fontSize: 17,
    color: D.textPrimary, paddingVertical: 17, paddingHorizontal: 14,
  },

  countryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 15,
    borderRadius: R.full, borderWidth: 1.5, borderColor: D.border, backgroundColor: D.card,
  },
  countryChipSel: { borderColor: D.coral, backgroundColor: D.coralFaint },
  countryFlag: { fontSize: 17 },
  countryName: { ...T.medium, fontSize: 14.5, color: D.textSecondary },
  countryNameSel: { color: D.coral },

  consentLabel: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2, marginTop: 26, marginBottom: 12 },
  consentCard: {
    backgroundColor: D.card, borderRadius: R.lg,
    borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 16,
  },
  consentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  consentDivider: { borderTopWidth: 1, borderTopColor: D.borderSubtle },
  consentName: { ...T.medium, fontSize: 15, color: D.textPrimary },
  consentSub: { ...T.regular, fontSize: 12.5, color: D.textSecondary, marginTop: 2, lineHeight: 17 },

  errorBox: {
    backgroundColor: D.errorSubtle, borderRadius: R.md,
    padding: 13, borderWidth: 1, borderColor: D.errorBorder, marginTop: 18,
  },
  errorText: { ...T.regular, fontSize: 13, color: D.error },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    paddingTop: 10,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.coral, borderRadius: R.full,
    paddingVertical: 17, gap: 10, ...Shadow.coral,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...T.bold, fontSize: 16.5, color: '#FFF', letterSpacing: -0.2 },
  ctaArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
});
