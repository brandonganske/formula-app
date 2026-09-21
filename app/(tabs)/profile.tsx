import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Switch, Alert, Keyboard,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import TikTokMark from '@/components/TikTokMark';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { D, T, R, Shadow, SectionLabelStyle } from '@/constants/ds';
import {
  LogOut, ExternalLink, Shield, ChevronRight, Zap, AtSign, X, Bell, Mail,
  HelpCircle, FileText, KeyRound, Check, Phone, CreditCard, Trash2,
  User, Calendar, MapPin, MessageSquare, MessageCircle, Compass,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { usePurchases } from '@/context/PurchasesContext';
import { planLabel, UNLIMITED_PLAN, CREDIT_PACKS, CREDIT_COSTS, FREE_MONTHLY_CREDITS, scriptsLabel } from '@/lib/iap/catalog';
import {
  GENDER_OPTIONS, AGE_RANGE_OPTIONS, COUNTRY_OPTIONS,
  labelFor, OptionDef, normalizeTikTokHandle, looksLikeLink,
} from '@/constants/onboarding';

// ─── Settings row ─────────────────────────────────────────────────────────────

// "$2.99" / 5 → "$0.60". Falls back to the raw string when the price isn't parseable.
function perScript(price: string, n: number): string {
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || n <= 0) return price;
  const sym = price.trim().match(/^[^0-9]*/)?.[0] ?? '$';
  return `${sym}${(num / n).toFixed(2)}`;
}

function SettingsRow({
  icon, label, sub, onPress, danger, externalLink, last, rightElement,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  externalLink?: boolean;
  last?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[SR.row, last && SR.rowLast]}
      onPress={onPress ? () => { haptic.tap(); onPress(); } : undefined}
      activeOpacity={onPress ? 0.72 : 1}
      disabled={!onPress}
    >
      <View style={[SR.iconBox, danger && SR.iconBoxDanger]}>{icon}</View>
      <View style={SR.body}>
        <Text style={[SR.label, danger && { color: D.coral }]}>{label}</Text>
        {sub ? <Text style={SR.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <View style={SR.end}>
        {rightElement
          ? rightElement
          : externalLink
            ? <ExternalLink size={14} color={D.textDisabled} strokeWidth={1.8} />
            : onPress && !danger
              ? <ChevronRight size={14} color={D.textDisabled} strokeWidth={2} />
              : null}
      </View>
    </TouchableOpacity>
  );
}

const SR = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: D.inkHairline,
    borderWidth: 1, borderColor: D.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxDanger: {
    backgroundColor: D.errorSubtle, borderColor: D.errorBorder,
  },
  body: { flex: 1, gap: 2 },
  label: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.1 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 18 },
  end: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ false: D.border, true: D.coral + 'AA' }}
      thumbColor={value ? D.coral : D.textDisabled}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// Settings. The creator's identity, DNA and performance live on the Profile
// tab (index); this screen is account plumbing only. Everything editable here
// is something the onboarding flow asked for, plus plan + account controls.
export default function SettingsScreen() {
  const { profile, logout, credits, unlimited, refreshMe, patchMe } = useAuth();
  const router = useRouter();
  const p = (profile ?? {}) as any;

  const tiktokLinked = profile?.tiktok_open_id != null;
  // TikTok / Apple signups get a synthetic placeholder address (e.g.
  // tiktok_<id>@users.formula.app) — never show that as if it were theirs.
  const isSyntheticEmail = (e: string) => /@users\.formula\.app$|tiktokformula/i.test(e);
  const hasEmail = !!p.email && !isSyntheticEmail(String(p.email));

  // The edit sheets pad the bottom for the home indicator; with the keyboard
  // up that padding becomes a dead white strip above the keys, so drop it.
  const [kbUp, setKbUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const sheetStyle = [M.sheet, kbUp && M.sheetKb];

  // ── Push (system permission) ────────────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(false);
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotifEnabled(status === 'granted'));
  }, []);
  const handleToggleNotif = async () => {
    if (notifEnabled) {
      Linking.openSettings();
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifEnabled(status === 'granted');
    }
  };

  // ── Contact opt-ins (same switches as onboarding) ───────────────────────
  type OptinKey = 'email_optin' | 'sms_optin' | 'whatsapp_optin';
  const [optinBusy, setOptinBusy] = useState<OptinKey | null>(null);
  const setOptin = async (key: OptinKey, value: boolean) => {
    setOptinBusy(key);
    const { error } = await patchMe({ [key]: value } as any);
    setOptinBusy(null);
    if (error) Alert.alert('Couldn’t save', error);
  };

  // ── Purchases ───────────────────────────────────────────────────────────
  const { restore, openCustomerCenter, purchase, priceById, available: iapAvailable } = usePurchases();
  const [restoring, setRestoring] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runPurchase = async (productId: string) => {
    if (!iapAvailable) {
      Alert.alert('Not available here', 'In-app purchases only work in the installed app build.');
      return;
    }
    setBusyId(productId);
    const res = await purchase(productId);
    setBusyId(null);
    if (res.ok) Alert.alert('Purchase complete', 'Your plan and scripts will update in a moment.');
    else if (!res.cancelled) Alert.alert('Couldn’t complete purchase', res.error ?? 'Please try again.');
  };

  const handleManageSubscription = async () => {
    if (!iapAvailable) {
      Alert.alert('Manage subscription', 'Subscription management opens in the installed app build.');
      return;
    }
    await openCustomerCenter();
  };

  const handleRestore = async () => {
    setRestoring(true);
    const res = await restore();
    setRestoring(false);
    Alert.alert(
      res.ok ? 'Purchases restored' : 'Restore failed',
      res.ok ? 'Your plan and scripts will update shortly.' : (res.error ?? 'Please try again.'),
    );
  };

  // ── TikTok connect (email accounts only) ────────────────────────────────
  const [connectingTikTok, setConnectingTikTok] = useState(false);
  const handleConnectTikTok = async () => {
    const redirect = 'formula://tiktok-connect';
    try {
      const url = `https://iq.influenceish.com/api/v1/tiktok/login?mode=connect&app_redirect=${encodeURIComponent(redirect)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, redirect);
      if (result.type !== 'success' || !result.url) return;
      const match = result.url.match(/[?&]ticket=([^&#]+)/);
      const ticket = match ? decodeURIComponent(match[1]) : null;
      if (!ticket) { Alert.alert('Connection failed', 'TikTok didn’t return a valid ticket. Please try again.'); return; }
      setConnectingTikTok(true);
      await api.post('/creators/tiktok/connect', { ticket });
      await refreshMe();
      Alert.alert('TikTok connected', 'One-tap sign-in and auto ingest are now enabled.');
    } catch (err: any) {
      const body = err?.response?.data ?? {};
      const msg = (typeof body?.error === 'string' ? body.error : body?.error?.message) || body?.message || err?.message;
      Alert.alert(
        err?.response?.status === 409 ? 'Already connected' : 'Connection failed',
        typeof msg === 'string' ? msg : 'Could not connect TikTok. Please try again.',
      );
    } finally {
      setConnectingTikTok(false);
    }
  };

  const handleChangePassword = async () => {
    if (!hasEmail) return;
    try {
      await api.post('/auth/forgot-password', { email: p.email });
      Alert.alert('Email sent', `A password reset link has been sent to ${p.email}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Could not send reset email.');
    }
  };

  // ── Handle edit (only when TikTok isn't linked — otherwise it's TikTok's) ─
  const [handleModal, setHandleModal] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [handleSaving, setHandleSaving] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const openHandleModal = () => { setHandleInput(profile?.handle ?? ''); setHandleError(null); setHandleModal(true); };
  const closeHandle = () => { Keyboard.dismiss(); setHandleModal(false); };
  const saveHandle = async () => {
    const trimmed = normalizeTikTokHandle(handleInput);
    if (!trimmed) { setHandleError('Handle cannot be empty'); return; }
    setHandleSaving(true); setHandleError(null);
    try {
      await api.patch('/creators/me', { handle: trimmed });
      await refreshMe();
      closeHandle();
      router.navigate('/(tabs)');
    } catch (err: any) {
      if (err?.response?.status === 409) { setHandleError('That handle is already taken — try a different one'); return; }
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? 'Failed to update handle';
      setHandleError(typeof msg === 'string' ? msg : 'Failed to update handle');
    } finally { setHandleSaving(false); }
  };

  // ── Editable onboarding answers (inline sheet) ──────────────────────────
  type EditConfig = {
    key: 'gender' | 'age_range' | 'region' | 'whatsapp';
    title: string;
    type: 'select' | 'text';
    options?: OptionDef[];
    placeholder?: string;
  };
  const [editField, setEditField] = useState<EditConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (cfg: EditConfig) => { setEditValue((p[cfg.key] as string) ?? ''); setEditError(null); setEditField(cfg); };
  // Dismiss the keyboard before hiding the sheet so a focused text input
  // doesn't flash its keypad on fade-out.
  const closeEdit = () => { Keyboard.dismiss(); setEditField(null); };
  const saveEdit = async () => {
    if (!editField) return;
    const val = editField.type === 'text' ? editValue.trim() : editValue;
    if (editField.type === 'select' && !val) { setEditError('Please pick an option.'); return; }
    setEditSaving(true); setEditError(null);
    const { error } = await patchMe({ [editField.key]: val } as any);
    setEditSaving(false);
    if (error) { setEditError(error); return; }
    closeEdit();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  // Apple Guideline 5.1.1(v): apps offering account creation must let users
  // delete their account in-app. Two confirmation steps guard against taps.
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your Formula account, your creator profile, and all saved scripts. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you sure?',
              'Your account and all associated data will be permanently erased. If you have an active subscription, cancel it separately in the App Store — deleting your account does not cancel it.',
              [
                { text: 'Keep My Account', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await api.delete('/auth/account');
                      await logout();
                      Alert.alert('Account Deleted', 'Your account and data have been permanently deleted.');
                    } catch (err: any) {
                      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message
                        ?? 'Could not delete your account. Please try again or contact hello@influenceish.com.';
                      Alert.alert('Deletion Failed', typeof msg === 'string' ? msg : 'Could not delete your account.');
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  const renews = profile?.plan_renews_at
    ? new Date(profile.plan_renews_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const planSub = profile?.plan_status && profile.plan_status !== 'active'
    ? `${planLabel(profile?.plan)} · ${profile.plan_status}`
    : renews ? `${planLabel(profile?.plan)} · renews ${renews}` : `${planLabel(profile?.plan)} plan`;

  return (
    <TabFadeView>
    <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
      {/* ── Title ───────────────────────────────────────────────── */}
      <FadeInView style={S.titleWrap}>
        <Text style={S.title}>Settings</Text>
        <Text style={S.titleSub}>{profile?.handle ? `@${profile.handle}` : 'Your account'}</Text>
      </FadeInView>

      {/* ── Plan & scripts ──────────────────────────────────────── */}
      <FadeInView delay={60} style={S.section}>
        <Text style={S.sectionLabel}>PLAN & SCRIPTS</Text>
        <View style={S.card}>
          <View style={S.balRow}>
            <View style={S.balIcon}><Zap size={18} color="#FFF" strokeWidth={2} fill="#FFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={S.balNum}>{unlimited ? 'Unlimited scripts' : `${credits} script${credits === 1 ? '' : 's'} left`}</Text>
              <Text style={S.balSub}>{planSub}</Text>
            </View>
            <View style={S.planBadge}><Text style={S.planBadgeText}>{planLabel(profile?.plan)}</Text></View>
          </View>

          <View style={S.divider} />

          {/* Unlimited — the one plan */}
          {(() => {
            const plan = UNLIMITED_PLAN;
            const price = priceById[plan.productId] ?? plan.priceLabel;
            const busy = busyId === plan.productId;
            return (
              <View style={[S.tierRow, S.tierRowPopular]}>
                <View style={{ flex: 1 }}>
                  <View style={S.tierTitleRow}>
                    <Text style={S.tierName}>Unlimited</Text>
                    {!unlimited && <View style={S.tierTag}><Text style={S.tierTagText}>BEST VALUE</Text></View>}
                  </View>
                  <Text style={S.tierCredits}>Every script and every tool. No counting.</Text>
                </View>
                <AnimatedPressable
                  style={[S.tierBtn, unlimited && S.tierBtnCurrent]}
                  hitSlop={8}
                  onPress={() => !unlimited && runPurchase(plan.productId)}
                  disabled={unlimited || busy}
                  haptic="medium"
                >
                  {busy
                    ? <ActivityIndicator size="small" color={D.coral} />
                    : unlimited
                      ? <Text style={[S.tierBtnText, { color: D.success }]}>Current</Text>
                      : <Text style={S.tierBtnText}>{price}<Text style={S.tierBtnPer}>/mo</Text></Text>}
                </AnimatedPressable>
              </View>
            );
          })()}

          {!unlimited && (
            <>
              <Text style={[S.subLabel, { marginTop: 16 }]}>Or top up</Text>
              <View style={S.packsRow}>
                {CREDIT_PACKS.map((pack) => {
                  const price = priceById[pack.productId] ?? pack.priceLabel;
                  const busy = busyId === pack.productId;
                  return (
                    <AnimatedPressable
                      key={pack.productId}
                      style={[S.packCard, pack.popular && S.packCardPopular]}
                      onPress={() => runPurchase(pack.productId)}
                      disabled={busy}
                      haptic="medium"
                    >
                      {pack.popular && <View style={S.packBadge}><Text style={S.packBadgeText}>POPULAR</Text></View>}
                      {busy
                        ? <ActivityIndicator size="small" color={D.coral} style={{ marginVertical: 14 }} />
                        : (
                          <>
                            <Text style={[S.packCredits, pack.popular && { color: D.coral }]}>{pack.credits}</Text>
                            <Text style={S.packLabel}>scripts</Text>
                            <Text style={[S.packPrice, pack.popular && { color: D.coral }]}>{price}</Text>
                            <Text style={S.packEach}>{perScript(price, pack.credits)} each</Text>
                          </>
                        )}
                    </AnimatedPressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={S.legal}>
            Unlimited renews monthly at the price shown until canceled in your App Store settings.{' '}
            <Text style={S.legalLink} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>Terms of Use</Text>
            {'  ·  '}
            <Text style={S.legalLink} onPress={() => Linking.openURL('https://www.influenceish.com/privacy-policy')}>Privacy Policy</Text>
          </Text>

          <Text style={S.costLine}>
            {unlimited
              ? 'Scripts, checks, breakdowns and coaching are all included. Fair use applies to video analysis.'
              : `1 script = 1 AI run  ·  Product analysis and script checks are free  ·  Profile refresh uses ${CREDIT_COSTS.brainRefresh}  ·  ${FREE_MONTHLY_CREDITS} free every month`}
          </Text>

          <View style={S.footRow}>
            <TouchableOpacity onPress={handleManageSubscription} activeOpacity={0.7} hitSlop={8}>
              <Text style={S.footLink}>Manage subscription</Text>
            </TouchableOpacity>
            <Text style={S.footDot}>·</Text>
            <TouchableOpacity onPress={handleRestore} disabled={restoring} activeOpacity={0.7} hitSlop={8}>
              {restoring
                ? <ActivityIndicator size="small" color={D.textMuted} />
                : <Text style={S.footLink}>Restore purchases</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </FadeInView>

      {/* ── About you (the onboarding answers) ──────────────────── */}
      <FadeInView delay={90} style={S.section}>
        <Text style={S.sectionLabel}>ABOUT YOU</Text>
        <View style={S.group}>
          <SettingsRow
            icon={<User size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Gender"
            sub={labelFor(GENDER_OPTIONS, p.gender) || 'Not set'}
            onPress={() => openEdit({ key: 'gender', title: 'A little about you', type: 'select', options: GENDER_OPTIONS })}
          />
          <SettingsRow
            icon={<Calendar size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Age range"
            sub={labelFor(AGE_RANGE_OPTIONS, p.age_range) || 'Not set'}
            onPress={() => openEdit({ key: 'age_range', title: 'Your age range', type: 'select', options: AGE_RANGE_OPTIONS })}
          />
          <SettingsRow
            icon={<MapPin size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Based in"
            sub={p.region || 'Not set'}
            onPress={() => openEdit({ key: 'region', title: 'Where are you based?', type: 'select', options: COUNTRY_OPTIONS })}
          />
          <SettingsRow
            icon={<Phone size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="WhatsApp"
            sub={p.whatsapp || 'Not set'}
            onPress={() => openEdit({ key: 'whatsapp', title: 'WhatsApp number', type: 'text', placeholder: 'e.g. +1 555 123 4567' })}
            last
          />
        </View>
      </FadeInView>

      {/* ── Notifications ───────────────────────────────────────── */}
      <FadeInView delay={120} style={S.section}>
        <Text style={S.sectionLabel}>NOTIFICATIONS</Text>
        <View style={S.group}>
          <SettingsRow
            icon={<Bell size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Push notifications"
            sub="When your profile and scripts are ready"
            rightElement={<Toggle value={notifEnabled} onChange={handleToggleNotif} />}
          />
          <SettingsRow
            icon={<Mail size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Email"
            sub="Tips, updates and the occasional offer"
            rightElement={<Toggle value={!!p.email_optin} disabled={optinBusy === 'email_optin'} onChange={(v) => setOptin('email_optin', v)} />}
          />
          <SettingsRow
            icon={<MessageSquare size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Text messages"
            sub="Time-sensitive alerts"
            rightElement={<Toggle value={!!p.sms_optin} disabled={optinBusy === 'sms_optin'} onChange={(v) => setOptin('sms_optin', v)} />}
          />
          <SettingsRow
            icon={<MessageCircle size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="WhatsApp"
            sub="Support and account updates"
            rightElement={<Toggle value={!!p.whatsapp_optin} disabled={optinBusy === 'whatsapp_optin'} onChange={(v) => setOptin('whatsapp_optin', v)} />}
            last
          />
        </View>
      </FadeInView>

      {/* ── Account ─────────────────────────────────────────────── */}
      <FadeInView delay={150} style={S.section}>
        <Text style={S.sectionLabel}>ACCOUNT</Text>
        <View style={S.group}>
          {tiktokLinked ? (
            <SettingsRow
              icon={<TikTokMark size={19} color={D.textPrimary} />}
              label="TikTok"
              sub={profile?.handle ? `@${profile.handle}` : 'Connected'}
              rightElement={<Check size={16} color={D.limeDeep} strokeWidth={2.5} />}
            />
          ) : (
            <>
              <SettingsRow
                icon={<TikTokMark size={19} color={D.textPrimary} />}
                label="Connect TikTok"
                sub={connectingTikTok ? 'Connecting…' : 'One-tap sign-in and auto refresh'}
                onPress={connectingTikTok ? undefined : handleConnectTikTok}
              />
              <SettingsRow
                icon={<AtSign size={19} color={D.textMuted} strokeWidth={1.8} />}
                label="TikTok username"
                sub={profile?.handle ? `@${profile.handle}` : 'Not set'}
                onPress={openHandleModal}
              />
            </>
          )}
          {hasEmail && (
            <SettingsRow
              icon={<Mail size={19} color={D.textMuted} strokeWidth={1.8} />}
              label="Email"
              sub={p.email}
            />
          )}
          {hasEmail && (
            <SettingsRow
              icon={<KeyRound size={19} color={D.textMuted} strokeWidth={1.8} />}
              label="Change password"
              sub="We’ll email you a reset link"
              onPress={handleChangePassword}
            />
          )}
          <SettingsRow
            icon={<CreditCard size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Subscription"
            sub={planSub}
            onPress={handleManageSubscription}
            last
          />
        </View>
      </FadeInView>

      {/* ── Support ─────────────────────────────────────────────── */}
      <FadeInView delay={180} style={S.section}>
        <Text style={S.sectionLabel}>SUPPORT</Text>
        <View style={S.group}>
          <SettingsRow
            icon={<Compass size={19} color={D.coral} strokeWidth={1.8} />}
            label="App tour"
            sub="A 60-second walk through every tab and tool"
            onPress={() => router.push('/tour')}
          />
          <SettingsRow
            icon={<HelpCircle size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Help & support"
            sub="hello@influenceish.com"
            onPress={() => Linking.openURL('mailto:hello@influenceish.com')}
            externalLink
          />
          <SettingsRow
            icon={<Shield size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Privacy policy"
            onPress={() => Linking.openURL('https://www.influenceish.com/privacy-policy')}
            externalLink
          />
          <SettingsRow
            icon={<FileText size={19} color={D.textMuted} strokeWidth={1.8} />}
            label="Terms of service"
            onPress={() => Linking.openURL('https://www.influenceish.com/terms-of-service')}
            externalLink
            last
          />
        </View>
      </FadeInView>

      {/* ── Sign out / delete ───────────────────────────────────── */}
      <FadeInView delay={210} style={S.section}>
        <View style={S.group}>
          <SettingsRow
            icon={<LogOut size={19} color={D.error} strokeWidth={1.8} />}
            label="Sign out"
            onPress={handleLogout}
            danger
          />
          <SettingsRow
            icon={<Trash2 size={19} color={D.error} strokeWidth={1.8} />}
            label="Delete account"
            sub={deleting ? 'Deleting…' : 'Permanently erase your account and data'}
            onPress={deleting ? undefined : handleDeleteAccount}
            danger
            last
          />
        </View>
      </FadeInView>

      <TouchableOpacity onPress={() => Linking.openURL('https://www.thecreatorformula.com')} activeOpacity={0.7}>
        <Text style={S.versionText}>Formula v{Constants.expoConfig?.version ?? '1.0.0'}  ·  by Influenceish</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* ── Handle edit sheet ───────────────────────────────────── */}
      <Modal visible={handleModal} transparent animationType="fade" onRequestClose={closeHandle}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={M.overlay}>
          <TouchableOpacity style={M.backdrop} activeOpacity={1} onPress={closeHandle} />
          <View style={sheetStyle}>
            <View style={M.sheetHeader}>
              <Text style={M.sheetTitle}>TikTok username</Text>
              <TouchableOpacity onPress={closeHandle} hitSlop={12}>
                <X size={20} color={D.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={M.sheetSub}>Your exact TikTok @handle, no spaces.</Text>
            <View style={M.inputRow}>
              <Text style={M.atSign}>@</Text>
              <TextInput
                style={M.input}
                value={handleInput}
                onChangeText={(t) => { setHandleInput(t.replace(/^@+/, '')); setHandleError(null); }}
                placeholder="yourhandle"
                placeholderTextColor={D.textDisabled}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveHandle}
              />
            </View>
            {looksLikeLink(handleInput) && <Text style={M.hint}>Just your handle — no links or URLs.</Text>}
            {handleError && <Text style={M.error}>{handleError}</Text>}
            <TouchableOpacity style={[M.saveBtn, handleSaving && { opacity: 0.6 }]} onPress={saveHandle} disabled={handleSaving} activeOpacity={0.85}>
              {handleSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={M.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Field edit sheet (gender / age / region / whatsapp) ────── */}
      <Modal visible={!!editField} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={M.overlay}>
          <TouchableOpacity style={M.backdrop} activeOpacity={1} onPress={closeEdit} />
          <View style={sheetStyle}>
            <View style={M.sheetHeader}>
              <Text style={M.sheetTitle}>{editField?.title}</Text>
              <TouchableOpacity onPress={closeEdit} hitSlop={12}>
                <X size={20} color={D.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {editField?.type === 'select' ? (
              <ScrollView style={{ maxHeight: 400, marginTop: 12 }} showsVerticalScrollIndicator={false}>
                {editField.options!.map((opt) => {
                  const selected = editValue === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[M.optRow, selected && M.optRowActive]}
                      onPress={() => setEditValue(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[M.optLabel, selected && M.optLabelActive]}>{opt.label}</Text>
                      {selected && <View style={M.optCheck}><Check size={12} color="#FFF" strokeWidth={3} /></View>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : editField?.type === 'text' ? (
              <View style={[M.inputRow, { marginTop: 12 }]}>
                <Phone size={16} color={D.textMuted} strokeWidth={2} style={{ marginRight: 8 }} />
                <TextInput
                  style={M.input}
                  value={editValue}
                  onChangeText={(t) => { setEditValue(t); setEditError(null); }}
                  placeholder={editField?.placeholder}
                  placeholderTextColor={D.textDisabled}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
            ) : null}

            {editError && <Text style={M.error}>{editError}</Text>}
            <TouchableOpacity style={[M.saveBtn, editSaving && { opacity: 0.6 }]} onPress={saveEdit} disabled={editSaving} activeOpacity={0.85}>
              {editSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={M.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
    </TabFadeView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingBottom: 16 },

  titleWrap: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 },
  title: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8, lineHeight: 34 },
  titleSub: { ...T.regular, fontSize: 14, color: D.textMuted, marginTop: 4 },

  section: { paddingHorizontal: 16, marginBottom: 22 },
  sectionLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 10, marginLeft: 4 },
  group: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, overflow: 'hidden',
    ...Shadow.soft,
  },
  card: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, overflow: 'hidden',
    padding: 16,
    ...Shadow.soft,
  },

  // Balance
  balRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...Shadow.coral,
  },
  balNum: { ...T.bold, fontSize: 19, color: D.textPrimary, letterSpacing: -0.4 },
  balSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 2 },
  planBadge: {
    backgroundColor: D.coralSubtle, borderRadius: R.full,
    paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: D.coral + '30', flexShrink: 0,
  },
  planBadgeText: { ...T.bold, fontSize: 12, color: D.coral },
  divider: { height: 1, backgroundColor: D.border, marginVertical: 14 },
  subLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 10 },

  // Plans
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.surface, borderRadius: R.lg, borderWidth: 1, borderColor: D.border,
    paddingVertical: 11, paddingHorizontal: 13, marginBottom: 8,
  },
  tierRowPopular: { borderColor: D.coral + '50', backgroundColor: D.coralSubtle },
  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierName: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  tierTag: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 2 },
  tierTagText: { ...T.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  tierCredits: { ...T.medium, fontSize: 12.5, color: D.textMuted, marginTop: 2 },
  tierBtn: {
    minWidth: 76, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: R.full, backgroundColor: D.coral,
  },
  tierBtnCurrent: { backgroundColor: D.successSubtle, borderWidth: 1, borderColor: D.successBorder },
  tierBtnText: { ...T.bold, fontSize: 13, color: '#FFF' },
  tierBtnPer: { ...T.medium, fontSize: 10, color: 'rgba(255,255,255,0.85)' },

  // Packs
  packsRow: { flexDirection: 'row', gap: 8 },
  packCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: R.lg, borderWidth: 1, borderColor: D.border, backgroundColor: D.surface,
    gap: 3, overflow: 'hidden',
  },
  packCardPopular: { borderColor: D.coral + '50', backgroundColor: D.coralSubtle },
  packBadge: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: D.coral, paddingVertical: 3, alignItems: 'center' },
  packBadgeText: { ...T.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  packCredits: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, marginTop: 14 },
  packLabel: { ...T.medium, fontSize: 11, color: D.textMuted },
  packPrice: { ...T.bold, fontSize: 15, color: D.textPrimary, marginTop: 6 },
  packEach: { ...T.regular, fontSize: 10.5, color: D.textMuted, marginTop: 1 },

  legal: { ...T.regular, fontSize: 11.5, color: D.textMuted, textAlign: 'center', lineHeight: 16, marginTop: 14 },
  legalLink: { ...T.bold, fontSize: 11.5, color: D.coral },
  costLine: { ...T.regular, fontSize: 12, color: D.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 14 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  footLink: { ...T.medium, fontSize: 13, color: D.coral },
  footDot: { ...T.regular, fontSize: 13, color: D.textDisabled },

  versionText: { ...T.regular, fontSize: 12, color: D.textDisabled, textAlign: 'center', marginTop: 4 },
});

const M = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: D.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.cardBorder,
    padding: 24, paddingBottom: 40,
  },
  sheetKb: { paddingBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.3 },
  sheetSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginBottom: 20, lineHeight: 18 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 18, height: 52, marginBottom: 12,
  },
  atSign: { ...T.bold, fontSize: 17, color: D.textMuted, marginRight: 4 },
  input: { ...T.medium, flex: 1, fontSize: 17, color: D.textPrimary },
  error: { ...T.regular, fontSize: 13, color: D.error, marginBottom: 12 },
  hint: { ...T.regular, fontSize: 13, color: D.coral, marginBottom: 12 },
  saveBtn: { backgroundColor: D.coral, borderRadius: R.full, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { ...T.bold, fontSize: 16, color: '#FFF' },
  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: R.md,
    borderWidth: 1, borderColor: D.border, backgroundColor: D.card, marginBottom: 8,
  },
  optRowActive: { borderColor: D.coral, backgroundColor: D.coralFaint },
  optLabel: { ...T.medium, fontSize: 15, color: D.textSecondary },
  optLabelActive: { ...T.bold, color: D.textPrimary },
  optCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center' },
});
