import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { getProgramsHome, programsAction, type ProgramsHome } from '@/lib/programs';
import { haptic } from '@/lib/haptics';
import { D, T, R } from '@/constants/ds';
import { X, Check, Landmark, Wallet, ChevronDown } from 'lucide-react-native';

// How you get paid — native version of the HQ payout page. Legal name, email,
// country and method are saved straight to HQ. PayPal is a Log in with PayPal
// connect (HQ owns the OAuth); the creator never types an email.
// Stripe's bank/identity step is the one piece Stripe insists on hosting, so
// it opens in an in-app sheet and returns to formula://payouts-return.

// Stripe only accepts https return URLs; IQ bounces this one to the app scheme.
const RETURN_URL = 'https://iq.influenceish.com/api/v1/payouts/return?to=' + encodeURIComponent('formula://payouts-return');
const PAYPAL_RETURN_URL = 'formula://payouts-return';
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' }, { code: 'IT', name: 'Italy' }, { code: 'NL', name: 'Netherlands' },
  { code: 'IE', name: 'Ireland' }, { code: 'MX', name: 'Mexico' }, { code: 'BR', name: 'Brazil' },
  { code: 'PH', name: 'Philippines' }, { code: 'ID', name: 'Indonesia' }, { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' }, { code: 'TH', name: 'Thailand' }, { code: 'VN', name: 'Vietnam' },
];
const errMsg = (e: any) => e?.response?.data?.error?.message || e?.message || 'Something went wrong';
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export default function PayoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery<ProgramsHome>({ queryKey: ['programs-home'], queryFn: getProgramsHome, staleTime: 30_000 });
  const d = q.data;
  const pr = d?.profile;

  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('US');
  const [method, setMethod] = useState<'stripe' | 'paypal' | null>(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!pr || seeded) return;
    setLegalName(pr.legalName ?? ''); setEmail(pr.email ?? ''); setCountry(pr.country || 'US');
    const offered = d?.paypalOffered === true || (pr.method === 'paypal' && !!pr.paypalEmail) || !!d?.paypal?.connected;
    setMethod(pr.method === 'paypal' && !offered ? 'stripe' : (pr.method ?? 'stripe')); setPaypalEmail(pr.paypalEmail ?? '');
    setSeeded(true);
  }, [pr, seeded, d?.stripeAvailable]);

  const stripeReady = !!pr?.stripeReady;
  const paypalReady = !!d?.paypal?.connected || (pr?.method === 'paypal' && !!pr?.paypalEmail);
  // Stripe-only by default; PayPal shows only when HQ offers it or it's already on file.
  const paypalOffered = d?.paypalOffered === true || paypalReady;
  const paypalEmailShown = d?.paypal?.email ?? pr?.paypalEmail ?? null;
  const [paypalBusy, setPaypalBusy] = useState(false);
  const blocked = d?.formula?.payoutsBlockedReason ?? null;
  const dirty = !!pr && (legalName !== (pr.legalName ?? '') || email !== (pr.email ?? '') || country !== (pr.country || 'US') || method !== pr.method || paypalEmail !== (pr.paypalEmail ?? ''));
  const valid = legalName.trim().length > 1 && isEmail(email) && !!method && (method !== 'paypal' || paypalReady || isEmail(paypalEmail));
  const countryName = useMemo(() => COUNTRIES.find((c) => c.code === country)?.name ?? country, [country]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['programs-home'] });

  const save = async (): Promise<boolean> => {
    if (!valid || !method) return false;
    setSaving(true);
    try {
      await programsAction({ action: 'profile', legalName: legalName.trim(), email: email.trim(), country, method, paypalEmail: method === 'paypal' ? (paypalEmailShown ?? paypalEmail.trim()) : undefined });
      haptic.success(); refresh();
      return true;
    } catch (e) { Alert.alert('Couldn’t save', errMsg(e)); return false; }
    finally { setSaving(false); }
  };

  // Stripe: save the profile first (Stripe needs country + email), then open
  // Stripe's hosted bank step in a sheet. When it returns, re-check status.
  const openStripe = async () => {
    if (dirty || !pr?.legalName) { const ok = await save(); if (!ok) return; }
    setStripeBusy(true);
    try {
      // Formula-branded page on HQ with Stripe's onboarding form embedded; it
      // returns to formula://payouts-return when Stripe reports the account
      // ready. Stripe's hosted link stays as the fallback.
      let url: string | undefined;
      try { url = (await programsAction({ action: 'payouts-page', returnUrl: PAYPAL_RETURN_URL })).url; } catch { url = undefined; }
      if (!url) url = (await programsAction({ action: 'stripe-link', returnUrl: RETURN_URL, refreshUrl: RETURN_URL })).url;
      if (!url) throw new Error('Stripe didn’t return a link');
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, dismissButtonStyle: 'close', controlsColor: D.coral, toolbarColor: '#FFFFFF' });
      await checkStripe();
    } catch (e) { Alert.alert('Couldn’t open Stripe', errMsg(e)); }
    finally { setStripeBusy(false); }
  };
  const checkStripe = async () => {
    try {
      const r = await programsAction({ action: 'stripe-status' });
      refresh();
      if (r.ready) { haptic.success(); Alert.alert('Bank account connected', 'You’re set. Commissions and deal payments go straight to your bank.'); }
    } catch { refresh(); }
  };
  useEffect(() => {
    const onUrl = (url: string | null) => {
      if (!url || !url.includes('payouts-return')) return;
      try { WebBrowser.dismissBrowser(); } catch { /* not open */ }
      checkStripe();
    };
    const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PayPal: Log in with PayPal through HQ. Save the profile first so the
  // legal name and email are on file, then open PayPal in a sheet; HQ's
  // callback returns to formula://payouts-return and we refetch.
  const connectPaypal = async () => {
    if (d?.paypalAvailable === false) { Alert.alert('PayPal not available yet', 'PayPal payouts aren’t set up on our side yet. Choose bank deposit for now.'); return; }
    if (dirty || !pr?.legalName) { const ok = await save(); if (!ok) return; }
    setPaypalBusy(true);
    try {
      const r = await programsAction({ action: 'paypal-connect', returnUrl: PAYPAL_RETURN_URL });
      if (!r.url) throw new Error('PayPal didn’t return a link');
      await WebBrowser.openBrowserAsync(r.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, dismissButtonStyle: 'close', controlsColor: D.coral, toolbarColor: '#FFFFFF' });
      refresh();
    } catch (e) { Alert.alert('Couldn’t open PayPal', errMsg(e)); }
    finally { setPaypalBusy(false); }
  };
  const disconnectPaypal = () => {
    Alert.alert('Disconnect PayPal?', 'You can connect it again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        try { await programsAction({ action: 'paypal-disconnect' }); haptic.success(); refresh(); }
        catch (e) { Alert.alert('Couldn’t disconnect', errMsg(e)); }
      } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[S.top, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textPrimary} strokeWidth={2.2} /></TouchableOpacity>
        <Text style={S.topTitle}>How you get paid</Text>
        <View style={S.close} />
      </View>
      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {q.isLoading ? <ActivityIndicator color={D.coral} style={{ marginTop: 40 }} /> : q.error ? (
          <View style={S.card}><Text style={S.muted}>{errMsg(q.error)}</Text></View>
        ) : blocked ? (
          <View style={S.card}><Text style={S.cardTitle}>Payouts are locked</Text><Text style={[S.muted, { marginTop: 4 }]}>{blocked}</Text></View>
        ) : (
          <>
            <FadeInView style={S.card}>
              <Text style={S.label}>LEGAL NAME</Text>
              <TextInput value={legalName} onChangeText={setLegalName} placeholder="As it appears on your ID" placeholderTextColor={D.textMuted} style={S.input} autoCapitalize="words" />
              <Text style={S.label}>EMAIL FOR PAYMENT NOTICES</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={D.textMuted} style={S.input} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
              <Text style={S.label}>COUNTRY</Text>
              <TouchableOpacity style={S.select} onPress={() => { haptic.tap(); setCountryOpen((v) => !v); }} activeOpacity={0.8}>
                <Text style={S.selectText}>{countryName}</Text><ChevronDown size={16} color={D.textMuted} />
              </TouchableOpacity>
              {countryOpen && (
                <View style={S.chips}>
                  {COUNTRIES.map((c) => (
                    <TouchableOpacity key={c.code} onPress={() => { haptic.select(); setCountry(c.code); setCountryOpen(false); }} style={[S.chip, country === c.code && S.chipOn]} activeOpacity={0.8}>
                      <Text style={[S.chipText, country === c.code && { color: '#FFF' }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </FadeInView>

            <FadeInView delay={40}>
              <Text style={[S.label, { marginLeft: 4, marginBottom: 10 }]}>PAY ME BY</Text>
              {d?.stripeAvailable !== false && (
                <TouchableOpacity style={[S.option, method === 'stripe' && S.optionOn]} onPress={() => { haptic.select(); setMethod('stripe'); }} activeOpacity={0.85}>
                  <View style={[S.optIcon, { backgroundColor: stripeReady ? D.limeDeep : D.ink }]}><Landmark size={17} color="#FFF" strokeWidth={2.2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.optTitle}>Bank deposit</Text>
                    <Text style={S.muted}>{stripeReady ? 'Connected via Stripe' : 'Direct to your bank, handled by Stripe. Takes about 2 minutes.'}</Text>
                  </View>
                  {stripeReady ? <Check size={18} color={D.limeDeep} strokeWidth={2.6} /> : <View style={[S.radio, method === 'stripe' && S.radioOn]} />}
                </TouchableOpacity>
              )}
              {paypalOffered && (
              <TouchableOpacity style={[S.option, method === 'paypal' && S.optionOn]} onPress={() => { haptic.select(); setMethod('paypal'); }} activeOpacity={0.85}>
                <View style={[S.optIcon, { backgroundColor: paypalReady ? D.limeDeep : '#0070BA' }]}><Wallet size={17} color="#FFF" strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.optTitle}>PayPal</Text>
                  <Text style={S.muted}>{paypalReady ? `Connected · ${paypalEmailShown ?? 'PayPal account'}` : 'Sign in to PayPal once. Ready right away.'}</Text>
                </View>
                {paypalReady && method === 'paypal' ? <Check size={18} color={D.limeDeep} strokeWidth={2.6} /> : <View style={[S.radio, method === 'paypal' && S.radioOn]} />}
              </TouchableOpacity>
              )}
            </FadeInView>

            {method === 'paypal' && (
              <FadeInView delay={60} style={S.card}>
                <Text style={S.cardTitle}>{paypalReady ? 'PayPal connected' : 'Connect your PayPal'}</Text>
                <Text style={[S.muted, { marginTop: 4 }]}>{paypalReady
                  ? `Payments go to ${paypalEmailShown ?? 'your PayPal account'}${d?.paypal?.verified === false ? ' · PayPal shows this account as unverified' : ''}.`
                  : 'You’ll sign in to PayPal inside the app. We only receive the account email and ID, never your password.'}</Text>
                {paypalReady ? (
                  <TouchableOpacity onPress={disconnectPaypal} style={S.linkBtn} activeOpacity={0.7}><Text style={[S.linkText, { color: D.textMuted }]}>Disconnect PayPal</Text></TouchableOpacity>
                ) : (
                  <AnimatedPressable haptic="medium" onPress={valid && !paypalBusy && !saving ? connectPaypal : undefined} style={[S.btn, { backgroundColor: '#0070BA' }, (!valid || paypalBusy || saving) && { opacity: 0.5 }]}>
                    {paypalBusy || saving ? <ActivityIndicator color="#FFF" /> : <Text style={S.btnText}>Log in with PayPal</Text>}
                  </AnimatedPressable>
                )}
                {!valid && !paypalReady && <Text style={[S.hint, { marginTop: 8 }]}>Add your legal name and email first.</Text>}
              </FadeInView>
            )}

            {method === 'stripe' && (
              <FadeInView delay={60} style={S.card}>
                <Text style={S.cardTitle}>{stripeReady ? 'Bank account connected' : 'Connect your bank'}</Text>
                <Text style={[S.muted, { marginTop: 4 }]}>{stripeReady ? 'Update your bank or identity details any time.' : 'Stripe verifies your identity and bank details on a secure page inside the app. Formula and Influenceish never see them.'}</Text>
                <AnimatedPressable haptic="medium" onPress={valid && !stripeBusy && !saving ? openStripe : undefined} style={[S.btn, (!valid || stripeBusy || saving) && { opacity: 0.5 }]}>
                  {stripeBusy || saving ? <ActivityIndicator color="#FFF" /> : <Text style={S.btnText}>{stripeReady ? 'Manage bank details' : 'Connect bank account'}</Text>}
                </AnimatedPressable>
                {!valid && <Text style={[S.hint, { marginTop: 8 }]}>Add your legal name and email first.</Text>}
              </FadeInView>
            )}

            {dirty && valid && (
              <TouchableOpacity onPress={save} style={S.linkBtn} activeOpacity={0.7}><Text style={S.linkText}>{saving ? 'Saving…' : 'Save details'}</Text></TouchableOpacity>
            )}
            <Text style={S.hint}>Payments from brand programs and deals are sent by Influenceish on each program’s payout schedule.</Text>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 16 },
  cardTitle: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3 },
  label: { ...T.bold, fontSize: 10.5, color: D.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 6 },
  input: { ...T.regular, height: 46, borderRadius: 14, borderWidth: 1, borderColor: D.border, paddingHorizontal: 14, fontSize: 15, color: D.textPrimary, backgroundColor: D.card, marginBottom: 8 },
  select: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: D.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  selectText: { ...T.regular, fontSize: 15, color: D.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderRadius: R.full, borderWidth: 1, borderColor: D.border, backgroundColor: D.card, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: D.ink, borderColor: D.ink },
  chipText: { ...T.bold, fontSize: 12.5, color: D.textSecondary },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.card, borderRadius: 18, borderWidth: 1, borderColor: D.border, padding: 14, marginBottom: 10 },
  optionOn: { borderColor: D.ink },
  optIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optTitle: { ...T.bold, fontSize: 15, color: D.textPrimary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: D.border },
  radioOn: { borderWidth: 6, borderColor: D.ink },
  muted: { ...T.regular, fontSize: 12.5, color: D.textMuted, lineHeight: 17, marginTop: 2 },
  hint: { ...T.regular, fontSize: 11.5, color: D.textMuted, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
  btn: { height: 48, borderRadius: R.full, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnText: { ...T.bold, fontSize: 15, color: '#FFF' },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  linkText: { ...T.bold, fontSize: 14, color: D.coral },
});
