import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Image,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Switch, Alert, Keyboard,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import TikTokMark from '@/components/TikTokMark';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { D, T, R, Shadow, Gradient, SectionLabelStyle } from '@/constants/ds';
import {
  LogOut, ExternalLink, Shield, Brain, ChevronRight,
  Zap, AtSign, X, Bell, Mail, HelpCircle, FileText,
  Users, Video, BookOpen, Target, KeyRound, Check, Phone, CreditCard, Trash2,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { api, extractData } from '@/lib/api';
import { SavedScriptsResponse } from '@/types/api';
import { usePurchases } from '@/context/PurchasesContext';
import { planLabel, SUB_PLANS, CREDIT_PACKS, CREDIT_COSTS, FREE_MONTHLY_CREDITS } from '@/lib/iap/catalog';
import {
  NICHE_OPTIONS, POST_FREQUENCY_OPTIONS, CREATION_GOAL_OPTIONS,
  labelFor, OptionDef, normalizeTikTokHandle, looksLikeLink,
} from '@/constants/onboarding';

// ─── Verified badge ───────────────────────────────────────────────────────────

function VerifiedBadge() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M12 2l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.6 2.6.6 2.6-2.3 1.4-1 2.5-2.7-.2L12 22l-2.2-1.6-2.7.2-1-2.5L3.8 16.3l.6-2.6-.6-2.6L6.1 7.7l1-2.5 2.7.2z"
        fill="#fff"
      />
      <Path
        d="M9 12l2 2 4-4.2"
        fill="none"
        stroke={D.coral}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────

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
      onPress={onPress}
      activeOpacity={onPress ? 0.72 : 1}
    >
      <View style={[SR.iconBox, danger && SR.iconBoxDanger]}>{icon}</View>
      <View style={SR.body}>
        <Text style={[SR.label, danger && { color: D.coral }]}>{label}</Text>
        {sub ? <Text style={SR.sub}>{sub}</Text> : null}
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
    width: 46, height: 46, borderRadius: 14,
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { profile, meData, logout, credits, refreshMe, patchMe } = useAuth();
  const router = useRouter();
  const creatorId = profile?.id ?? null;

  const { data: scriptsData } = useQuery({
    queryKey: ['saved-scripts'],
    queryFn: async () => {
      const res = await api.get('/creators/scripts');
      const d = extractData<SavedScriptsResponse>(res);
      return d?.scripts ?? (Array.isArray(d) ? d : []);
    },
    staleTime: 60_000,
  });
  const savedScriptsCount = scriptsData?.length ?? 0;

  const { data: savedProductsCount = 0 } = useQuery({
    queryKey: ['saved-products-count', creatorId],
    queryFn: async () => {
      if (!creatorId) return 0;
      const res = await api.get('/creators/saved-products');
      const d = extractData<{ products?: unknown[]; count?: number }>(res);
      return d?.count ?? d?.products?.length ?? 0;
    },
    enabled: !!creatorId,
    staleTime: 30_000,
  });

  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === 'granted');
    });
  }, []);

  const handleToggleNotif = async () => {
    if (notifEnabled) {
      Linking.openSettings();
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifEnabled(status === 'granted');
    }
  };

  const { restore, openCustomerCenter, purchase, priceById, available: iapAvailable } = usePurchases();
  const [restoring, setRestoring] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentTier = (profile?.plan ?? 'free').toLowerCase();

  const runPurchase = async (productId: string) => {
    if (!iapAvailable) {
      Alert.alert(
        'Not available here',
        'In-app purchases only work in the installed app build, not Expo Go.',
      );
      return;
    }
    setBusyId(productId);
    const res = await purchase(productId);
    setBusyId(null);
    if (res.ok) {
      Alert.alert('Purchase complete', 'Your plan and credits will update in a moment.');
    } else if (!res.cancelled) {
      Alert.alert('Couldn’t complete purchase', res.error ?? 'Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    if (!iapAvailable) {
      Alert.alert('Manage subscription', 'Subscription management opens in the installed app build (not Expo Go).');
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
      res.ok ? 'Your plan and credits will update shortly.' : (res.error ?? 'Please try again.'),
    );
  };

  // ── TikTok connect (link this TikTok to the signed-in account) ──────────
  const [connectingTikTok, setConnectingTikTok] = useState(false);
  const handleConnectTikTok = async () => {
    const redirect = 'formula://tiktok-connect';
    try {
      const url = `https://iq.influenceish.com/api/v1/tiktok/login?mode=connect&app_redirect=${encodeURIComponent(redirect)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, redirect);
      if (result.type !== 'success' || !result.url) return; // user backed out
      const match = result.url.match(/[?&]ticket=([^&#]+)/);
      const ticket = match ? decodeURIComponent(match[1]) : null;
      if (!ticket) {
        Alert.alert('Connection failed', 'TikTok didn’t return a valid ticket. Please try again.');
        return;
      }
      setConnectingTikTok(true);
      await api.post('/creators/tiktok/connect', { ticket });
      await refreshMe();
      Alert.alert('TikTok connected', 'One-tap sign-in and auto ingest are now enabled.');
    } catch (err: any) {
      const body = err?.response?.data ?? {};
      const msg =
        (typeof body?.error === 'string' ? body.error : body?.error?.message) ||
        body?.message ||
        err?.message ||
        'Could not connect TikTok. Please try again.';
      Alert.alert(
        err?.response?.status === 409 ? 'Already connected' : 'Connection failed',
        typeof msg === 'string' ? msg : 'Could not connect TikTok. Please try again.',
      );
    } finally {
      setConnectingTikTok(false);
    }
  };

  const handleChangePassword = async () => {
    const email = (profile as any)?.email;
    if (!email) { Alert.alert('Error', 'No email address found on your account.'); return; }
    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert('Email Sent', `A password reset link has been sent to ${email}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Could not send reset email.');
    }
  };

  const [handleModal, setHandleModal] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [handleSaving, setHandleSaving] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  const openHandleModal = () => {
    setHandleInput(profile?.handle ?? '');
    setHandleError(null);
    setHandleModal(true);
  };

  const saveHandle = async () => {
    const trimmed = normalizeTikTokHandle(handleInput);
    if (!trimmed) { setHandleError('Handle cannot be empty'); return; }
    setHandleSaving(true); setHandleError(null);
    try {
      await api.patch('/creators/me', { handle: trimmed });
      await refreshMe();
      Keyboard.dismiss();
      setHandleModal(false);
      router.navigate('/(tabs)');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setHandleError('That handle is already taken — try a different one');
        return;
      }
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? 'Failed to update handle';
      setHandleError(typeof msg === 'string' ? msg : 'Failed to update handle');
    } finally { setHandleSaving(false); }
  };

  // ── Editable onboarding fields (inline modals) ──────────────────────────
  type EditConfig = {
    key: 'primary_niche' | 'post_frequency' | 'creation_goal' | 'whatsapp';
    title: string;
    type: 'select' | 'text';
    options?: OptionDef[];
    placeholder?: string;
  };
  const [editField, setEditField] = useState<EditConfig | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (cfg: EditConfig) => {
    setEditValue(((profile as any)?.[cfg.key] as string) ?? '');
    setEditError(null);
    setEditField(cfg);
  };

  // Dismiss the keyboard before hiding the modal so a focused text input
  // (e.g. the phone-pad WhatsApp field) doesn't flash its keypad on fade-out.
  const closeEdit = () => { Keyboard.dismiss(); setEditField(null); };
  const closeHandle = () => { Keyboard.dismiss(); setHandleModal(false); };

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
    // Don't rely solely on the tab layout's auth redirect — navigate explicitly.
    router.replace('/');
  };

  // Apple Guideline 5.1.1(v): apps offering account creation must let users
  // delete their account in-app. Two confirmation steps guard against taps.
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your Formula account, your creator brain, and all saved scripts. This can’t be undone.',
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
                      const msg =
                        err?.response?.data?.error?.message ??
                        err?.response?.data?.message ??
                        err?.message ??
                        'Could not delete your account. Please try again or contact hello@influenceish.com.';
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

  const fmtCount = (n: number | null | undefined) => {
    if (!n) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const followerCount = (profile as any)?.follower_count as number | undefined;
  const videoCount = (profile as any)?.video_count as number | undefined;

  const initials = (
    (profile?.display_name ?? profile?.handle ?? 'C')[0] ?? 'C'
  ).toUpperCase();

  const displayName = profile?.display_name ?? (profile?.handle ? `@${profile.handle}` : 'Creator');
  const showHandle = !!(profile?.handle && profile?.display_name);
  const [imgError, setImgError] = useState(false);
  const avatarUrl = profile?.avatar_url && !imgError ? profile.avatar_url : null;

  return (
    <TabFadeView>
    <ScrollView
      style={S.root}
      contentContainerStyle={S.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Coral gradient hero card ────────────────────────────── */}
      <FadeInView style={S.heroWrap}>
        <LinearGradient
          colors={Gradient.hero}
          locations={[0, 0.52, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={S.hero}
        >
          {/* Yellow glow — top right */}
          <View style={S.glowYellow} pointerEvents="none" />
          {/* Pink glow — bottom left */}
          <View style={S.glowPink} pointerEvents="none" />

          <View style={S.heroInner}>
            {/* Avatar */}
            <View style={S.avatar}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={S.avatarImg}
                  onError={() => setImgError(true)}
                />
              ) : (
                <Text style={S.avatarText}>{initials}</Text>
              )}
            </View>

            {/* Name + verified */}
            <View style={S.nameRow}>
              <Text style={S.displayName}>{displayName}</Text>
              <VerifiedBadge />
            </View>

            {showHandle && (
              <Text style={S.handle}>@{profile!.handle}</Text>
            )}

            {/* Niche pill */}
            {(Array.isArray(profile?.niche) ? profile!.niche.length > 0 : !!profile?.niche) ? (
              <View style={S.nichePill}>
                <View style={S.nicheDot} />
                <Text style={S.nicheText}>
                  {Array.isArray(profile?.niche) ? profile!.niche.join(' · ') : profile?.niche}
                </Text>
              </View>
            ) : null}

            {/* Stats glass card */}
            <View style={S.statsCard}>
              {followerCount != null ? (
                <>
                  <View style={S.statCell}>
                    <Text style={[S.statValue, S.statValueAccent]}>{fmtCount(followerCount)}</Text>
                    <Text style={S.statLabel}>Followers</Text>
                  </View>
                  <View style={S.statDivider} />
                  <View style={S.statCell}>
                    <Text style={S.statValue}>{fmtCount(videoCount)}</Text>
                    <Text style={S.statLabel}>Videos</Text>
                  </View>
                  <View style={S.statDivider} />
                  <View style={S.statCell}>
                    <Text style={S.statValue}>{savedScriptsCount}</Text>
                    <Text style={S.statLabel}>Scripts</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={S.statCell}>
                    <Text style={S.statValue}>{savedScriptsCount}</Text>
                    <Text style={S.statLabel}>Saved Scripts</Text>
                  </View>
                  <View style={S.statDivider} />
                  <View style={S.statCell}>
                    <Text style={[S.statValue, S.statValueAccent]}>{savedProductsCount}</Text>
                    <Text style={S.statLabel}>Saved Products</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* ── Credits ─────────────────────────────────────────────── */}
      <FadeInView delay={100} style={S.section}>
        <Text style={S.sectionLabel}>CREDITS</Text>
        <View style={S.creditsCard}>
          {/* Balance row */}
          <View style={S.creditsBal}>
            <View style={S.creditsIconWrap}>
              <Zap size={20} color="#FFF" strokeWidth={2} fill="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.creditsBalNum}>{credits} credits</Text>
              <Text style={S.creditsBalSub}>{planLabel(profile?.plan)} plan · refills monthly</Text>
            </View>
            <View style={S.planBadge}>
              <Text style={S.planBadgeText}>{planLabel(profile?.plan)}</Text>
              {profile?.plan_status && profile.plan_status !== 'active' ? (
                <Text style={S.planBadgeStatus}>{profile.plan_status}</Text>
              ) : null}
            </View>
          </View>

          <View style={S.creditsDivider} />

          {/* Subscription tiers */}
          <Text style={S.creditsPackLabel}>Monthly plans</Text>
          {SUB_PLANS.map((plan) => {
            const isCurrent = currentTier === plan.tier;
            const price = priceById[plan.productId] ?? plan.priceLabel;
            const popular = plan.tier === 'pro';
            return (
              <View key={plan.productId} style={[S.tierRow, popular && S.tierRowPopular]}>
                <View style={{ flex: 1 }}>
                  <View style={S.tierTitleRow}>
                    <Text style={S.tierName}>{plan.name}</Text>
                    {popular && <View style={S.tierTag}><Text style={S.tierTagText}>POPULAR</Text></View>}
                  </View>
                  <Text style={S.tierCredits}>{plan.monthlyCredits} credits / month</Text>
                </View>
                <AnimatedPressable
                  style={[S.tierBtn, isCurrent && S.tierBtnCurrent]}
                  hitSlop={8}
                  onPress={() => !isCurrent && runPurchase(plan.productId)}
                  disabled={isCurrent || busyId === plan.productId}
                  haptic="medium"
                >
                  {busyId === plan.productId
                    ? <ActivityIndicator size="small" color={D.coral} />
                    : isCurrent
                      ? <Text style={[S.tierBtnText, { color: D.success }]}>Current</Text>
                      : <Text style={S.tierBtnText}>{price}<Text style={S.tierBtnPer}>/mo</Text></Text>}
                </AnimatedPressable>
              </View>
            );
          })}

          {/* Top-up packs */}
          <Text style={[S.creditsPackLabel, { marginTop: 20 }]}>One-time load up</Text>
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
                  {pack.popular && <View style={S.packBadge}><Text style={S.packBadgeText}>BEST</Text></View>}
                  {busy
                    ? <ActivityIndicator size="small" color={D.coral} style={{ marginVertical: 14 }} />
                    : (
                      <>
                        <Text style={[S.packCredits, pack.popular && { color: D.coral }]}>{pack.credits}</Text>
                        <Text style={S.packLabel}>credits</Text>
                        <Text style={[S.packPrice, pack.popular && { color: D.coral }]}>{price}</Text>
                      </>
                    )}
                </AnimatedPressable>
              );
            })}
          </View>

          {/* Cost explainer */}
          <View style={S.costBox}>
            <Text style={S.costTitle}>What credits get you</Text>
            <Text style={S.costLine}>1 script  ·  {CREDIT_COSTS.script} credit</Text>
            <Text style={S.costLine}>1 product analysis  ·  {CREDIT_COSTS.productAnalysis} credit</Text>
            <Text style={S.costLine}>Brain refresh  ·  {CREDIT_COSTS.brainRefresh} credits</Text>
            <Text style={S.costLine}>Free plan  ·  {FREE_MONTHLY_CREDITS} credits every month</Text>
          </View>

          <TouchableOpacity style={S.restoreRow} onPress={handleRestore} disabled={restoring} activeOpacity={0.7}>
            {restoring
              ? <ActivityIndicator size="small" color={D.textMuted} />
              : <Text style={S.restoreRowText}>Restore purchases</Text>}
          </TouchableOpacity>

          <Text style={S.iapNote}>
            Purchases are processed securely through the App Store or Google Play.
          </Text>
        </View>
      </FadeInView>

      {/* ── Creator Profile (editable) ─────────────────────────── */}
      <FadeInView delay={90} style={S.section}>
        <Text style={S.sectionLabel}>CREATOR PROFILE</Text>
        <View style={S.group}>
          <SettingsRow
            icon={<BookOpen size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Niche"
            sub={labelFor(NICHE_OPTIONS, (profile as any)?.primary_niche) || 'Not set'}
            onPress={() => openEdit({ key: 'primary_niche', title: 'Your niche', type: 'select', options: NICHE_OPTIONS })}
          />
          <SettingsRow
            icon={<Video size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Post Frequency"
            sub={labelFor(POST_FREQUENCY_OPTIONS, (profile as any)?.post_frequency) || 'Not set'}
            onPress={() => openEdit({ key: 'post_frequency', title: 'How often you post', type: 'select', options: POST_FREQUENCY_OPTIONS })}
          />
          <SettingsRow
            icon={<Target size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Content Goal"
            sub={labelFor(CREATION_GOAL_OPTIONS, (profile as any)?.creation_goal) || 'Not set'}
            onPress={() => openEdit({ key: 'creation_goal', title: 'Why you create', type: 'select', options: CREATION_GOAL_OPTIONS })}
          />
          <SettingsRow
            icon={<Phone size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="WhatsApp"
            sub={(profile as any)?.whatsapp || 'Not set'}
            onPress={() => openEdit({ key: 'whatsapp', title: 'WhatsApp number', type: 'text', placeholder: 'e.g. +1 555 123 4567' })}
            last
          />
        </View>
      </FadeInView>

      {/* ── Account ─────────────────────────────────────────────── */}
      <FadeInView delay={80} style={S.section}>
        <Text style={S.sectionLabel}>ACCOUNT</Text>
        <View style={S.group}>
          {(profile as any)?.email && (
            <SettingsRow
              icon={<Mail size={20} color={D.textMuted} strokeWidth={1.8} />}
              label="Email"
              sub={(profile as any).email}
            />
          )}
          {(profile as any)?.whatsapp && (
            <SettingsRow
              icon={<Phone size={20} color={D.textMuted} strokeWidth={1.8} />}
              label="WhatsApp"
              sub={(profile as any).whatsapp}
            />
          )}
          {profile?.tiktok_open_id == null ? (
            <SettingsRow
              icon={<TikTokMark size={20} color={D.textPrimary} />}
              label="Connect TikTok"
              sub={connectingTikTok ? 'Connecting…' : 'One-tap sign-in + auto ingest'}
              onPress={connectingTikTok ? undefined : handleConnectTikTok}
            />
          ) : (
            <SettingsRow
              icon={<TikTokMark size={20} color={D.textPrimary} />}
              label="TikTok connected"
              sub={profile?.handle ? `@${profile.handle}` : undefined}
              rightElement={<Check size={16} color={D.limeDeep} strokeWidth={2.5} />}
            />
          )}
          <SettingsRow
            icon={<AtSign size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="TikTok Username"
            sub={profile?.handle ? `@${profile.handle}` : 'Not set'}
            onPress={openHandleModal}
          />
          <SettingsRow
            icon={<CreditCard size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Manage Subscription"
            sub={`${planLabel(profile?.plan)} plan${profile?.plan_renews_at ? ' · renews ' + new Date(profile.plan_renews_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`}
            onPress={handleManageSubscription}
          />
          <SettingsRow
            icon={<Bell size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Push Notifications"
            sub={notifEnabled ? 'Enabled' : 'Disabled'}
            onPress={handleToggleNotif}
            rightElement={
              <Switch
                value={notifEnabled}
                onValueChange={handleToggleNotif}
                trackColor={{ false: D.border, true: D.coral + 'AA' }}
                thumbColor={notifEnabled ? D.coral : D.textDisabled}
              />
            }
          />
          <SettingsRow
            icon={<Brain size={20} color={D.coral} strokeWidth={1.8} />}
            label="Re-analyze My Content"
            sub="Refresh your brain model with latest videos"
            onPress={() => router.navigate('/(tabs)')}
          />
          <SettingsRow
            icon={<Shield size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Privacy Policy"
            sub="How we handle your data"
            onPress={() => Linking.openURL('https://www.influenceish.com/privacy-policy')}
            externalLink
          />
          <SettingsRow
            icon={<FileText size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Terms of Service"
            sub="Usage terms and conditions"
            onPress={() => Linking.openURL('https://www.influenceish.com/terms-of-service')}
            externalLink
          />
          <SettingsRow
            icon={<HelpCircle size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Help & Support"
            sub="Get help or report an issue"
            onPress={() => Linking.openURL('mailto:hello@influenceish.com')}
            externalLink
          />
          <SettingsRow
            icon={<KeyRound size={20} color={D.textMuted} strokeWidth={1.8} />}
            label="Change Password"
            sub="Send a reset link to your email"
            onPress={handleChangePassword}
          />
          <SettingsRow
            icon={<LogOut size={20} color={D.error} strokeWidth={1.8} />}
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
          <SettingsRow
            icon={<Trash2 size={20} color={D.error} strokeWidth={1.8} />}
            label="Delete Account"
            sub={deleting ? 'Deleting…' : 'Permanently delete your account and data'}
            onPress={deleting ? undefined : handleDeleteAccount}
            danger
            last
          />
        </View>
      </FadeInView>

      <Text style={S.versionText}>
        Formula v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
      <Text style={S.madeInText}>Made in California</Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://www.thecreatorformula.com')} activeOpacity={0.7}>
        <Text style={S.siteLink}>www.thecreatorformula.com</Text>
      </TouchableOpacity>
      <Text style={S.madeInText}>Influenceish Agency</Text>

      <View style={{ height: 48 }} />

      {/* ── Handle edit modal ────────────────────────────────────── */}
      <Modal visible={handleModal} transparent animationType="fade" onRequestClose={closeHandle}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={M.overlay}>
          <TouchableOpacity style={M.backdrop} activeOpacity={1} onPress={closeHandle} />
          <View style={M.sheet}>
            <View style={M.sheetHeader}>
              <Text style={M.sheetTitle}>TikTok Username</Text>
              <TouchableOpacity onPress={closeHandle} hitSlop={12}>
                <X size={20} color={D.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={M.sheetSub}>Enter your exact TikTok @handle (no spaces)</Text>
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
            {looksLikeLink(handleInput) && (
              <Text style={M.hint}>Just your handle — no links or URLs.</Text>
            )}
            {handleError && <Text style={M.error}>{handleError}</Text>}
            <TouchableOpacity
              style={[M.saveBtn, handleSaving && { opacity: 0.6 }]}
              onPress={saveHandle}
              disabled={handleSaving}
              activeOpacity={0.85}
            >
              {handleSaving
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={M.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ── Edit field modal (niche / frequency / goal / whatsapp) ─── */}
      <Modal visible={!!editField} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={M.overlay}>
          <TouchableOpacity style={M.backdrop} activeOpacity={1} onPress={closeEdit} />
          <View style={M.sheet}>
            <View style={M.sheetHeader}>
              <Text style={M.sheetTitle}>{editField?.title}</Text>
              <TouchableOpacity onPress={closeEdit} hitSlop={12}>
                <X size={20} color={D.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {editField?.type === 'select' ? (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
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
                      {selected && (
                        <View style={M.optCheck}><Check size={12} color="#FFF" strokeWidth={3} /></View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : editField?.type === 'text' ? (
              <View style={M.inputRow}>
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
            <TouchableOpacity
              style={[M.saveBtn, editSaving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={editSaving}
              activeOpacity={0.85}
            >
              {editSaving
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={M.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
    </TabFadeView>
  );
}

// ─── Credit packs ────────────────────────────────────────────────────────────

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingBottom: 16 },

  heroWrap: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 28,
    borderRadius: R.xxl, overflow: 'hidden',
    shadowColor: D.coral, shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.30, shadowRadius: 46, elevation: 14,
  },
  hero: {
    borderRadius: R.xxl, overflow: 'hidden',
    paddingBottom: 26,
  },

  // Glow decorations
  glowYellow: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    top: -90, right: -90,
    backgroundColor: 'rgba(255,214,107,0.40)',
  },
  glowPink: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    bottom: -130, left: -70,
    backgroundColor: 'rgba(255,94,138,0.38)',
  },

  heroInner: {
    position: 'relative', zIndex: 2,
    alignItems: 'center', paddingHorizontal: 22, paddingTop: 34,
  },

  // Avatar
  avatar: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.70)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(120,0,20,1)', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28, shadowRadius: 26, elevation: 8,
  },
  avatarText: { ...T.bold, fontSize: 42, color: '#FFF', letterSpacing: -0.5 },
  avatarImg: { width: 98, height: 98, borderRadius: 49 },

  // Name row
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
  },
  displayName: {
    ...T.bold, fontSize: 26, color: '#FFF',
    letterSpacing: -0.5, textAlign: 'center',
  },
  handle: {
    ...T.regular, fontSize: 15,
    color: 'rgba(255,255,255,0.82)', marginTop: 3,
  },

  // Niche pill
  nichePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 14, paddingHorizontal: 15, paddingVertical: 7,
    borderRadius: R.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)',
  },
  nicheDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: D.lime,
  },
  nicheText: { ...T.bold, fontSize: 13, color: '#FFF' },

  // Stats glass card
  statsCard: {
    flexDirection: 'row', marginTop: 22, width: '100%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: R.xl, overflow: 'hidden',
  },
  statCell: {
    flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10,
  },
  statDivider: {
    width: 1, backgroundColor: 'rgba(255,255,255,0.26)',
    marginVertical: 16,
  },
  statValue: { ...T.bold, fontSize: 30, color: '#FFF', letterSpacing: -0.5, lineHeight: 34 },
  statValueAccent: { color: D.lime },
  statLabel: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 8 },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: {
    ...T.bold, ...SectionLabelStyle,
    marginBottom: 12, marginLeft: 4,
  },
  group: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, overflow: 'hidden',
    ...Shadow.soft,
  },

  // Credits card
  creditsCard: {
    backgroundColor: D.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: D.cardBorder,
    overflow: 'hidden',
    ...Shadow.soft,
    padding: 18,
  },
  creditsBal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  creditsIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    ...Shadow.coral,
  },
  creditsBalNum: { ...T.bold, fontSize: 20, color: D.textPrimary, letterSpacing: -0.4 },
  creditsBalSub: { ...T.regular, fontSize: 12, color: D.textMuted, marginTop: 2 },
  planBadge: {
    alignItems: 'center', backgroundColor: D.coralSubtle, borderRadius: R.full,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: D.coral + '30', flexShrink: 0,
  },
  planBadgeText: { ...T.bold, fontSize: 12, color: D.coral, letterSpacing: -0.1 },
  planBadgeStatus: { ...T.medium, fontSize: 10, color: D.textMuted, marginTop: 1, textTransform: 'capitalize' },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 14, ...Shadow.coral,
  },
  manageBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  restoreRow: { alignItems: 'center', paddingVertical: 13 },
  restoreRowText: { ...T.medium, fontSize: 13, color: D.textMuted },
  creditsDivider: { height: 1, backgroundColor: D.border, marginBottom: 16 },
  creditsPackLabel: {
    ...T.bold, ...SectionLabelStyle, marginBottom: 12,
  },
  packsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  packCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: D.border,
    backgroundColor: D.surface,
    gap: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  packCardPopular: {
    borderColor: D.coral + '50',
    backgroundColor: D.coralSubtle,
  },
  packBadge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: D.coral,
    paddingVertical: 3,
    alignItems: 'center',
  },
  packBadgeText: { ...T.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  packCredits: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, marginTop: 14 },
  packLabel: { ...T.medium, fontSize: 11, color: D.textMuted },
  packPrice: { ...T.bold, fontSize: 15, color: D.textPrimary, marginTop: 6 },

  // Subscription tier rows
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.surface, borderRadius: R.lg, borderWidth: 1, borderColor: D.border,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  tierRowPopular: { borderColor: D.coral + '50', backgroundColor: D.coralSubtle },
  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierName: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  tierTag: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 2 },
  tierTagText: { ...T.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  tierCredits: { ...T.medium, fontSize: 12.5, color: D.textMuted, marginTop: 3 },
  tierBtn: {
    minWidth: 76, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: R.full,
    backgroundColor: D.coral,
  },
  tierBtnCurrent: { backgroundColor: D.successSubtle, borderWidth: 1, borderColor: D.successBorder },
  tierBtnText: { ...T.bold, fontSize: 13, color: '#FFF' },
  tierBtnPer: { ...T.medium, fontSize: 10, color: 'rgba(255,255,255,0.85)' },

  // Cost explainer
  costBox: {
    backgroundColor: D.inkCard, borderRadius: R.lg, padding: 14, marginTop: 6, marginBottom: 14, gap: 6,
  },
  costTitle: { ...T.bold, fontSize: 10, color: D.lime, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  costLine: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  iapNote: {
    ...T.regular,
    fontSize: 11,
    color: D.textDisabled,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },

  versionText: {
    ...T.regular,
    fontSize: 12,
    color: D.textDisabled,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  madeInText: {
    ...T.regular,
    fontSize: 11,
    color: D.textDisabled,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  siteLink: {
    ...T.medium,
    fontSize: 11,
    color: D.coral,
    textAlign: 'center',
    marginBottom: 16,
  },
});

const M = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: D.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.cardBorder,
    padding: 24, paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  sheetTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.3 },
  sheetSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginBottom: 20, lineHeight: 18 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: D.surface, borderRadius: 14,
    borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 14, height: 52, marginBottom: 12,
  },
  atSign: { ...T.bold, fontSize: 17, color: D.textMuted, marginRight: 4 },
  input: { ...T.medium, flex: 1, fontSize: 17, color: D.textPrimary },
  error: { ...T.regular, fontSize: 13, color: D.error, marginBottom: 12 },
  hint: { ...T.regular, fontSize: 13, color: D.coral, marginBottom: 12 },
  saveBtn: {
    backgroundColor: D.coral, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  saveBtnText: { ...T.bold, fontSize: 16, color: '#FFF' },

  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: R.md,
    borderWidth: 1, borderColor: D.border, backgroundColor: D.card, marginBottom: 8,
  },
  optRowActive: { borderColor: D.coral, backgroundColor: D.coralFaint },
  optLabel: { ...T.medium, fontSize: 15, color: D.textSecondary },
  optLabelActive: { ...T.bold, color: D.textPrimary },
  optCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center',
  },
});
