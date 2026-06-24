import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Switch,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { D, T, R, Shadow } from '@/constants/ds';
import { Check, ArrowRight, ArrowLeft, MapPin, Phone } from 'lucide-react-native';
import Svg, { Rect } from 'react-native-svg';
import { OnboardingPatch } from '@/types/api';
import { NICHE_OPTIONS, POST_FREQUENCY_OPTIONS, CREATION_GOAL_OPTIONS } from '@/constants/onboarding';

// ─── Formula F mark ───────────────────────────────────────────────────────────

function FormulaMark({ size = 14 }: { size?: number }) {
  const scale = size / 20;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="24" y="18" width="16" height="64" rx="8" fill="#FFFFFF" />
      <Rect x="24" y="18" width="54" height="16" rx="8" fill="#B6FF8A" />
      <Rect x="24" y="45" width="40" height="15" rx="7.5" fill="#FFFFFF" />
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option { label: string; value: string; sub?: string }

const TOTAL_STEPS = 4;

// ─── Screen definitions ───────────────────────────────────────────────────────

type FieldDef = {
  key: keyof OnboardingPatch;
  label: string;
  sub: string;
  options?: Option[];
  textInput?: boolean;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
};

const SCREEN_1_FIELDS: FieldDef[] = [
  {
    key: 'display_name',
    label: 'Your name',
    sub: 'How we\'ll address you in the app.',
    textInput: true,
    placeholder: 'e.g. Alex Rivera',
    autoCapitalize: 'words',
  },
  {
    key: 'gender',
    label: 'Your gender',
    sub: 'Helps us write scripts in your authentic voice.',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Non-binary', value: 'non_binary' },
      { label: 'Prefer not to say', value: 'prefer_not_to_say' },
    ],
  },
  {
    key: 'age_range',
    label: 'Age range',
    sub: 'Tunes vocabulary and cultural references.',
    options: [
      { label: '18 – 24', value: '18-24' },
      { label: '25 – 34', value: '25-34' },
      { label: '35 – 44', value: '35-44' },
      { label: '45+', value: '45+' },
    ],
  },
  {
    key: 'region',
    label: 'Where you\'re based',
    sub: 'Filters trending content to your market.',
    textInput: true,
    placeholder: 'e.g. United States',
  },
];

const SCREEN_2_FIELDS: FieldDef[] = [
  {
    key: 'primary_niche',
    label: 'Your niche',
    sub: 'Pre-seeds your brain before the AI analysis.',
    options: NICHE_OPTIONS,
  },
  {
    key: 'experience_level',
    label: 'Experience level',
    sub: 'Calibrates how confident your rewrites sound.',
    options: [
      { label: 'Just starting out', value: 'just_starting', sub: 'Less than 6 months' },
      { label: '1 – 2 years', value: '1-2_years' },
      { label: '3+ years', value: '3+_years' },
    ],
  },
  {
    key: 'post_frequency',
    label: 'How often you post',
    sub: 'Drives cadence recommendations.',
    options: POST_FREQUENCY_OPTIONS,
  },
];

const SCREEN_3_FIELDS: FieldDef[] = [
  {
    key: 'creation_goal',
    label: 'Why you create',
    sub: 'Shapes the CTA style in every rewrite.',
    options: CREATION_GOAL_OPTIONS,
  },
  {
    key: 'audience_gender',
    label: 'Audience gender',
    sub: 'Targets rewrites to your viewer, not you.',
    options: [
      { label: 'Mostly men', value: 'mostly_men' },
      { label: 'Mostly women', value: 'mostly_women' },
      { label: 'Mixed', value: 'mixed' },
    ],
  },
  {
    key: 'biggest_challenge',
    label: 'Your biggest challenge',
    sub: 'Personalises what we surface first.',
    options: [
      { label: 'Writing hooks', value: 'hooks' },
      { label: 'Scripting content', value: 'scripts' },
      { label: 'Staying consistent', value: 'consistency' },
      { label: 'Converting viewers', value: 'conversion' },
    ],
  },
];

const SCREEN_4_FIELDS: FieldDef[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp number',
    sub: 'Optional — for support and important account updates. We\'ll never share it.',
    textInput: true,
    placeholder: 'e.g. +1 555 123 4567',
    keyboardType: 'phone-pad',
    autoCapitalize: 'none',
  },
];

// Contact-channel consent opt-ins shown on the final step.
const OPTIN_CHANNELS: { key: 'whatsapp' | 'sms' | 'push' | 'email'; label: string; sub: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', sub: 'Support and account updates.' },
  { key: 'sms', label: 'Text messages', sub: 'Time-sensitive alerts via SMS.' },
  { key: 'push', label: 'Push notifications', sub: 'When your creator brain is ready.' },
  { key: 'email', label: 'Email', sub: 'Tips, updates, and the occasional offer.' },
];

// ─── Small components ─────────────────────────────────────────────────────────

function OptionChip({
  option, selected, onPress,
}: { option: Option; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[chipS.wrap, selected && chipS.wrapSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={chipS.inner}>
        <View style={{ flex: 1 }}>
          <Text style={[chipS.label, selected && chipS.labelSelected]}>{option.label}</Text>
          {option.sub ? <Text style={chipS.sub}>{option.sub}</Text> : null}
        </View>
        {selected && (
          <View style={chipS.check}>
            <Check size={12} color="#FFF" strokeWidth={3} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function FieldBlock({
  field,
  value,
  onChange,
  delay,
}: {
  field: (typeof SCREEN_1_FIELDS)[number];
  value: string;
  onChange: (v: string) => void;
  delay: number;
}) {
  return (
    <FadeInView delay={delay} direction="down" style={fbS.wrap}>
      <Text style={fbS.label}>{field.label}</Text>
      <Text style={fbS.sub}>{field.sub}</Text>
      {field.textInput ? (
        <View style={fbS.textRow}>
          <View style={fbS.textIcon}>
            {field.key === 'whatsapp'
              ? <Phone size={14} color={D.textMuted} strokeWidth={2} />
              : <MapPin size={14} color={D.textMuted} strokeWidth={2} />}
          </View>
          <TextInput
            style={fbS.textInput}
            placeholder={field.placeholder}
            placeholderTextColor={D.textDisabled}
            value={value}
            onChangeText={onChange}
            keyboardType={field.keyboardType}
            autoCapitalize={field.autoCapitalize ?? 'words'}
            autoCorrect={false}
          />
        </View>
      ) : (
        <View style={fbS.chips}>
          {field.options!.map((opt) => (
            <OptionChip
              key={opt.value}
              option={opt}
              selected={value === opt.value}
              onPress={() => onChange(value === opt.value ? '' : opt.value)}
            />
          ))}
        </View>
      )}
    </FadeInView>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={progS.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[progS.dot, i < step && progS.dotActive, i === step - 1 && progS.dotCurrent]} />
      ))}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { patchMe, refreshMe } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All answers live in one flat object
  const [answers, setAnswers] = useState<Partial<OnboardingPatch>>({});

  // Contact-channel consent opt-ins (default OFF — user actively consents).
  const [optins, setOptins] = useState({ whatsapp: false, sms: false, push: false, email: false });
  const toggleOptin = (k: keyof typeof optins) => setOptins((p) => ({ ...p, [k]: !p[k] }));

  const set = (key: keyof OnboardingPatch, val: string) =>
    setAnswers((prev) => ({ ...prev, [key]: val || undefined }));

  const handleNext = async () => {
    setError(null);
    setSaving(true);

    // Build the patch for this screen
    const screenKeys: (keyof OnboardingPatch)[][] = [
      ['display_name', 'gender', 'age_range', 'region'],
      ['primary_niche', 'experience_level', 'post_frequency'],
      ['creation_goal', 'audience_gender', 'biggest_challenge'],
      ['whatsapp'],
    ];
    const keys = screenKeys[step - 1];
    const patch: OnboardingPatch = {};
    for (const k of keys) {
      if (answers[k]) (patch as any)[k] = answers[k];
    }
    // Final step also carries the contact-channel consent opt-ins.
    if (step === TOTAL_STEPS) {
      patch.whatsapp_optin = optins.whatsapp;
      patch.sms_optin = optins.sms;
      patch.push_optin = optins.push;
      patch.email_optin = optins.email;
      patch.complete = true;
    }

    const result = await patchMe(patch);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      // Confirm onboarding_completed_at is set, then enter the app
      await refreshMe();
      router.replace('/(tabs)');
    }
  };

  const screenTitles = ['About You', 'Your Content', 'Your Goals', 'Stay Connected'];
  const screenSubs = [
    'Tell us a bit about yourself.',
    'Help us understand your content.',
    'Tell us what you\'re here to achieve.',
    'Last step — how we reach you if needed.',
  ];

  const currentFields =
    step === 1 ? SCREEN_1_FIELDS
    : step === 2 ? SCREEN_2_FIELDS
    : step === 3 ? SCREEN_3_FIELDS
    : SCREEN_4_FIELDS;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={S.root}
    >
      <View style={S.bgGlow} />

      {/* Header */}
      <View style={S.topBar}>
        {step > 1 ? (
          <TouchableOpacity style={S.backBtn} onPress={() => setStep((s) => s - 1)} hitSlop={12}>
            <ArrowLeft size={18} color={D.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        ) : <View style={S.backBtn} />}

        <ProgressDots step={step} total={TOTAL_STEPS} />

        <TouchableOpacity onPress={handleNext} hitSlop={12} style={S.skipBtn} disabled={saving}>
          <Text style={S.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={S.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <FadeInView direction="none" duration={300} style={S.logoRow}>
          <View style={S.logoMark}>
            <FormulaMark size={18} />
          </View>
          <Text style={S.stepLabel}>{step} of {TOTAL_STEPS}</Text>
        </FadeInView>

        {/* Title */}
        <FadeInView key={`title-${step}`} direction="down" style={S.headline}>
          <Text style={S.title}>{screenTitles[step - 1]}</Text>
          <Text style={S.sub}>{screenSubs[step - 1]}</Text>
        </FadeInView>

        {/* Fields */}
        <View style={S.fields}>
          {(currentFields as typeof SCREEN_1_FIELDS).map((field, i) => (
            <FieldBlock
              key={`${step}-${field.key}`}
              field={field}
              value={(answers as any)[field.key] ?? ''}
              onChange={(v) => set(field.key, v)}
              delay={i * 60}
            />
          ))}
        </View>

        {/* Contact opt-ins (final step) */}
        {step === TOTAL_STEPS && (
          <FadeInView delay={120} direction="down" style={S.optinWrap}>
            <Text style={S.optinLabel}>How can we reach you?</Text>
            <Text style={S.optinHint}>All optional — choose what you're comfortable with.</Text>
            {OPTIN_CHANNELS.map((c) => (
              <View key={c.key} style={S.optinRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.optinName}>{c.label}</Text>
                  <Text style={S.optinSub}>{c.sub}</Text>
                </View>
                <Switch
                  value={optins[c.key]}
                  onValueChange={() => toggleOptin(c.key)}
                  trackColor={{ false: D.border, true: D.coral + 'AA' }}
                  thumbColor={optins[c.key] ? D.coral : D.textDisabled}
                />
              </View>
            ))}
          </FadeInView>
        )}

        {/* Error */}
        {error && (
          <FadeInView direction="none" duration={200} style={S.errorBox}>
            <Text style={S.errorText}>{error}</Text>
          </FadeInView>
        )}

        {/* CTA */}
        <FadeInView delay={220} direction="down" style={undefined}>
          <TouchableOpacity
            style={[S.nextBtn, saving && S.nextBtnDisabled]}
            onPress={handleNext}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={S.nextBtnText}>
                  {step < TOTAL_STEPS ? 'Continue' : 'Finish Setup'}
                </Text>
                <View style={S.nextArrow}>
                  <ArrowRight size={15} color="#FFF" strokeWidth={2.5} />
                </View>
              </>
            )}
          </TouchableOpacity>
        </FadeInView>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const chipS = StyleSheet.create({
  wrap: {
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: D.border,
    backgroundColor: D.card,
  },
  wrapSelected: {
    borderColor: D.coral,
    backgroundColor: D.coralFaint,
  },
  inner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 10,
  },
  label: { ...T.medium, fontSize: 14, color: D.textSecondary },
  labelSelected: { color: D.textPrimary },
  sub: { ...T.regular, fontSize: 11, color: D.textMuted, marginTop: 2 },
  check: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center',
  },
});

const fbS = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 4 },
  label: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 19, marginBottom: 2 },
  chips: { gap: 8 },
  textRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: D.card, borderRadius: R.md,
    borderWidth: 1, borderColor: D.border,
  },
  textIcon: { paddingLeft: 14, paddingRight: 4 },
  textInput: {
    flex: 1, ...T.regular, fontSize: 15,
    color: D.textPrimary, paddingVertical: 14, paddingHorizontal: 8,
  },
});

const progS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: D.surface,
    borderWidth: 1, borderColor: D.border,
  },
  dotActive: { backgroundColor: D.coral + '50', borderColor: D.coral + '40' },
  dotCurrent: { width: 20, backgroundColor: D.coral, borderColor: D.coral },
});

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },

  bgGlow: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: D.coralGlow, opacity: 0.25,
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  skipText: { ...T.medium, fontSize: 13, color: D.textMuted },

  scroll: { paddingHorizontal: 24, paddingBottom: 40 },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28, marginTop: 8,
  },
  logoMark: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { ...T.medium, fontSize: 12, color: D.textMuted, letterSpacing: 0.3 },

  headline: { marginBottom: 28 },
  title: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8, lineHeight: 38 },
  sub: { ...T.regular, fontSize: 14, color: D.textSecondary, marginTop: 8, lineHeight: 22 },

  fields: { gap: 28, marginBottom: 24 },

  optinWrap: {
    backgroundColor: D.coralFaint, borderRadius: R.md,
    borderWidth: 1, borderColor: D.border,
    padding: 18, marginBottom: 24,
  },
  optinLabel: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  optinHint: { ...T.regular, fontSize: 12.5, color: D.textSecondary, marginTop: 3, marginBottom: 6, lineHeight: 18 },
  optinRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: D.border,
  },
  optinName: { ...T.medium, fontSize: 14.5, color: D.textPrimary },
  optinSub: { ...T.regular, fontSize: 12, color: D.textSecondary, marginTop: 2, lineHeight: 16 },

  errorBox: {
    backgroundColor: D.errorSubtle, borderRadius: R.sm,
    padding: 13, borderWidth: 1, borderColor: D.errorBorder, marginBottom: 16,
  },
  errorText: { ...T.regular, fontSize: 13, color: D.error },

  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.coral, borderRadius: R.full,
    paddingVertical: 16, gap: 10,
    ...Shadow.coral,
  },
  nextBtnDisabled: { opacity: 0.55 },
  nextBtnText: { ...T.bold, fontSize: 16, color: '#FFF', letterSpacing: -0.2 },
  nextArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
