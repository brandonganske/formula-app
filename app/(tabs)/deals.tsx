import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, RefreshControl, Alert, Animated, Linking } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { getProgramsHome, programsAction, type ProgramsHome } from '@/lib/programs';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import { useTikTokLink } from '@/lib/tiktok-link';
import { D, T, R, Gradient, Shadow } from '@/constants/ds';
import { Handshake, Check, Megaphone, Wallet, ChevronDown, TrendingUp, Inbox, Sparkles, Clapperboard, Copy, Tag, FileSignature, FileDown, Landmark } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

// Deals tab: brand programs, deal offers, deals/retainers, payments, post
// submissions and payout setup — served by Influenceish HQ through IQ.
// Payout setup is also reachable from Settings › Payments.

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const errMsg = (e: any) => e?.response?.data?.error?.message || e?.message || 'Something went wrong';
const DEAL_LABEL = { package: 'Video package', per_video: 'Per video', retainer: 'Monthly retainer' } as const;
const shortDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type Seg = 'open' | 'invites' | 'videos' | 'earnings';
type EarnTab = 'active' | 'challenges' | 'payments' | 'agreements';
const EARN_TABS: { key: EarnTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'payments', label: 'How you get paid' },
  { key: 'agreements', label: 'Agreements' },
];
const SEGS: { key: Seg; label: string; Icon: any }[] = [
  { key: 'open', label: 'Open', Icon: Sparkles },
  { key: 'invites', label: 'Invites', Icon: Inbox },
  { key: 'videos', label: 'Videos', Icon: Clapperboard },
  { key: 'earnings', label: 'Earnings', Icon: TrendingUp },
];

export default function DealsScreen() {
  const qc = useQueryClient();
  const q = useQuery<ProgramsHome>({ queryKey: ['programs-home'], queryFn: getProgramsHome, staleTime: 30_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['programs-home'] });
  const d = q.data;

  // Split everything HQ sends into the four areas.
  const invites = useMemo(() => ({
    offers: d?.offers ?? [],
    programs: (d?.programs ?? []).filter((p) => p.status !== 'active'),
  }), [d]);
  const active = useMemo(() => ({
    programs: (d?.programs ?? []).filter((p) => p.status === 'active'),
    deals: d?.deals ?? [],
  }), [d]);
  const toSign = (d?.agreements ?? []).filter((a) => a.needsSignature && a.status !== 'void');
  const signed = (d?.agreements ?? []).filter((a) => !a.needsSignature && (a.status === 'signed' || a.status === 'countersigned'));
  const inviteCount = invites.offers.length + invites.programs.length + toSign.length;
  // Just signed on the web and downloaded the app? Payouts are the next step.
  const payoutReady = !!d?.profile && (d.profile.method === 'stripe' ? !!d.profile.stripeReady : d.profile.method === 'paypal' ? (!!d.paypal?.connected || !!d.profile.paypalEmail) : false);
  const needsPayout = !!d?.linked && !payoutReady && !d?.formula?.payoutsBlockedReason && (signed.length > 0 || active.programs.length > 0 || active.deals.length > 0);
  const openCount = (d?.open?.length ?? 0) + (d?.challenges ?? []).filter((c) => !c.joined).length;

  // Land on the area that needs attention first.
  const [seg, setSeg] = useState<Seg | null>(null);
  const [earnTab, setEarnTab] = useState<EarnTab>('active');
  // Deep links (notifications) can open a specific area: /(tabs)/deals?seg=invites
  const { seg: segParam } = useLocalSearchParams<{ seg?: string }>();
  useEffect(() => { if (segParam && SEGS.some((x) => x.key === segParam)) setSeg(segParam as Seg); }, [segParam]);
  const current: Seg = seg ?? (inviteCount ? 'invites' : active.programs.length || active.deals.length ? 'earnings' : 'open');
  const { profile } = useAuth();
  const router = useRouter();
  const tiktok = useTikTokLink();
  const needsTikTok = !!profile && !profile.tiktok_open_id;
  const [segW, setSegW] = useState(0);
  const segX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!segW) return;
    Animated.spring(segX, { toValue: SEGS.findIndex((x) => x.key === current) * segW, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
  }, [current, segW]);

  const earnedAll = (active.programs.map((p) => (p.earningsAllTime ?? p.earnings)?.earned ?? 0).reduce((a, b) => a + b, 0)) + active.deals.reduce((a, x) => a + x.earned, 0);

  return (
    <TabFadeView>
      <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={D.coral} />}>
        <FadeInView style={S.pageHead}>
          <Text style={S.title}>Deals</Text>
          <Text style={S.sub}>Brand programs, offers and payouts.</Text>
        </FadeInView>

        <FadeInView delay={20} style={S.heroWrap}>
          <LinearGradient colors={Gradient.hero} start={{ x: 0.13, y: 0 }} end={{ x: 0.87, y: 1 }} style={S.hero}>
            <View style={S.circleA} /><View style={S.circleB} />
            <View style={S.eyebrowRow}><Handshake size={14} color="#FFF" strokeWidth={2.4} /><Text style={S.heroEyebrow}>Brand programs</Text></View>
            <Text style={S.heroHeadline}>{d?.linked ? (earnedAll > 0 ? `${money(earnedAll)} earned\nwith brands so far.` : 'Get paid for the\nvideos you already make.') : 'Brands find you here.'}</Text>
            <Text style={S.heroSub}>{d?.creator?.handle ? `@${d.creator.handle}` : ''}{d?.creator?.handle ? ' · ' : ''}{inviteCount ? `${inviteCount} waiting on you` : openCount ? `${openCount} open to join` : 'Commissions, deal offers and retainers, paid out to your bank or PayPal.'}</Text>
          </LinearGradient>
        </FadeInView>

        <View style={S.segWrap}>
          <View style={S.seg} onLayout={(e) => setSegW((e.nativeEvent.layout.width - 8) / SEGS.length)}>
            {segW > 0 && <Animated.View style={[S.segPill, { width: segW, transform: [{ translateX: segX }] }]} pointerEvents="none" />}
            {SEGS.map((x) => {
              const on = current === x.key;
              const n = x.key === 'invites' ? inviteCount : x.key === 'open' ? openCount : 0;
              return (
                <TouchableOpacity key={x.key} style={S.segBtn} onPress={() => { haptic.select(); setSeg(x.key); }} activeOpacity={0.85}>
                  <Text style={[S.segTxt, on && S.segTxtOn]}>{x.label}</Text>
                  {n > 0 && <Text style={[S.segNum, on && S.segNumOn]}>{n}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={S.body}>
          {needsTikTok && (
            <TouchableOpacity style={S.nudge} onPress={tiktok.linking ? undefined : tiktok.link} activeOpacity={0.85}>
              <View style={S.nudgeIcon}><Handshake size={16} color={D.ink} strokeWidth={2.4} /></View>
              <View style={{ flex: 1 }}>
                <Text style={S.nudgeTitle}>Link TikTok to unlock payouts</Text>
                <Text style={S.nudgeSub}>Brands book verified creators. Linking takes one tap and turns on bank or PayPal payouts.</Text>
              </View>
              <Text style={S.nudgeCta}>{tiktok.linking ? '…' : 'Link'}</Text>
            </TouchableOpacity>
          )}
          {needsPayout && (
            <TouchableOpacity style={[S.nudge, { backgroundColor: D.ink }]} onPress={() => { haptic.tap(); router.push('/payouts' as any); }} activeOpacity={0.85}>
              <View style={[S.nudgeIcon, { backgroundColor: 'rgba(255,255,255,0.12)' }]}><Landmark size={16} color={D.lime} strokeWidth={2.4} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[S.nudgeTitle, { color: '#FFF' }]}>Set up how you get paid</Text>
                <Text style={[S.nudgeSub, { color: 'rgba(255,255,255,0.65)' }]}>Bank deposit or PayPal. Takes two minutes, then payouts run automatically.</Text>
              </View>
              <Text style={[S.nudgeCta, { backgroundColor: D.lime, color: D.ink }]}>Set up</Text>
            </TouchableOpacity>
          )}
          {q.isLoading ? (
            <ActivityIndicator color={D.coral} style={{ marginTop: 40 }} />
          ) : q.error ? (
            <Card><Text style={S.muted}>{errMsg(q.error)}</Text></Card>
          ) : !d ? null : current === 'open' ? (
            <>
              {(d.open ?? []).map((o, i) => <FadeInView key={o.id} delay={i * 40}><OpenCard o={o} onDone={refresh} /></FadeInView>)}
              {(d.challenges ?? []).filter((c) => !c.joined).map((c, i) => <FadeInView key={c.id} delay={i * 40}><ChallengeCard c={c} onDone={refresh} /></FadeInView>)}
              {!(d.open ?? []).length && !(d.challenges ?? []).filter((c) => !c.joined).length && (
                <Empty title="Nothing open right now" body={d.linked ? 'Programs and offers any creator can join show up here. Check back soon.' : (d.message || 'Connect your TikTok in Settings so brands can find you.')} />
              )}
            </>
          ) : current === 'invites' ? (
            <>
              {toSign.map((a, i) => <FadeInView key={a.id} delay={i * 40}><AgreementCard a={a} /></FadeInView>)}
              {invites.offers.map((o, i) => <FadeInView key={o.memberId} delay={i * 40}><OfferCard o={o} onDone={refresh} /></FadeInView>)}
              {invites.programs.map((p, i) => <FadeInView key={p.enrollmentId} delay={i * 40}><ProgramCard p={p} onDone={refresh} /></FadeInView>)}
              {!inviteCount && <Empty title="No invites yet" body="When a brand invites you directly to a program or sends you a deal offer, it lands here." />}
            </>
          ) : current === 'videos' ? (
            <>
              {d.submitBrands.length ? <AuthorizeVideo d={d} onDone={refresh} /> : <Empty title="No brands to authorize for yet" body="Once you’re in a program or a deal, you can authorize your TikTok and Instagram videos for that brand to run as ads." />}
            </>
          ) : (
            <>
              <Tracker d={d} active={active} />

              <ScrollView horizontal showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={S.subTabs}>
                {EARN_TABS.map((t) => {
                  const on = earnTab === t.key;
                  const n = t.key === 'active' ? active.programs.length + active.deals.length
                    : t.key === 'challenges' ? (d.challenges ?? []).filter((c) => c.joined).length
                    : t.key === 'agreements' ? signed.length : 0;
                  return (
                    <TouchableOpacity key={t.key} style={[S.subTab, on && S.subTabOn]} onPress={() => { haptic.select(); setEarnTab(t.key); }} activeOpacity={0.85}>
                      <Text style={[S.subTabText, on && S.subTabTextOn]}>{t.label}{n > 0 ? ` ${n}` : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {earnTab === 'active' && (
                <>
                  {active.programs.map((p, i) => <FadeInView key={p.enrollmentId} delay={i * 40}><ProgramCard p={p} onDone={refresh} /></FadeInView>)}
                  {active.deals.map((x, i) => <FadeInView key={x.id} delay={i * 40}><DealCard d={x} /></FadeInView>)}
                  {!active.programs.length && !active.deals.length && <Empty title="Nothing active yet" body="Programs you've joined and deals you've accepted show up here." />}
                </>
              )}
              {earnTab === 'challenges' && (
                <>
                  {(d.challenges ?? []).filter((c) => c.joined).map((c, i) => <FadeInView key={c.id} delay={i * 40}><ChallengeCard c={c} onDone={refresh} /></FadeInView>)}
                  {!(d.challenges ?? []).filter((c) => c.joined).length && <Empty title="No challenges joined" body="Open bonus challenges live under Open. Join one and track it here." />}
                </>
              )}
              {earnTab === 'payments' && (
                <>
                  <PayoutRow d={d} />
                  {d.payouts.length > 0 ? <Payments d={d} /> : <Empty title="No payments yet" body="Commission and deal payments land here as they're sent." />}
                </>
              )}
              {earnTab === 'agreements' && (
                <>
                  {signed.length > 0 ? <SignedAgreements list={signed} /> : <Empty title="No agreements yet" body="Signed brand agreements are kept here with a PDF copy." />}
                </>
              )}
            </>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </TabFadeView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={S.sectionLabel}>{text.toUpperCase()}</Text>;
}

// Compact payout method row: status at a glance, tap to manage on the native payouts screen.
function PayoutRow({ d }: { d: ProgramsHome }) {
  const router = useRouter();
  const pr = d.profile;
  const paypalOk = !!d.paypal?.connected || (pr?.method === 'paypal' && !!pr?.paypalEmail);
  const ready = pr?.method === 'stripe' ? !!pr?.stripeReady : pr?.method === 'paypal' ? paypalOk : false;
  const blocked = d.formula?.payoutsBlockedReason;
  const sub = blocked ? blocked
    : ready ? (pr?.method === 'stripe' ? 'Bank deposit via Stripe' : `PayPal · ${d.paypal?.email ?? pr?.paypalEmail ?? 'connected'}`)
    : pr?.payoutSetupStartedAt && !pr?.payoutSetupCompletedAt ? 'Started, not finished · tap to continue'
    : 'Add a bank account or PayPal';
  return (
    <TouchableOpacity style={S.rowCard} onPress={() => { if (blocked) { Alert.alert('Payouts locked', blocked); return; } haptic.tap(); router.push('/payouts' as any); }} activeOpacity={0.85}>
      <View style={[S.smallIcon, { backgroundColor: ready ? D.limeDeep : D.coral }]}><Wallet size={16} color="#FFF" strokeWidth={2.2} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={S.cardTitle}>How you get paid</Text>
        <Text style={S.muted} numberOfLines={1}>{sub}</Text>
      </View>
      {ready ? <Check size={18} color={D.limeDeep} strokeWidth={2.6} /> : <Pill text="Set up" tone="coral" />}
    </TouchableOpacity>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return <Card><Text style={S.cardTitle}>{title}</Text><Text style={[S.muted, { marginTop: 4 }]}>{body}</Text></Card>;
}

// Open programs and offers: join from the app (same as the /join/<slug> link).
function OpenCard({ o, onDone }: { o: NonNullable<ProgramsHome['open']>[number]; onDone: () => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true);
    try {
      const r = await programsAction({ action: 'join', slug: o.slug });
      haptic.success(); onDone();
      Alert.alert(r.status === 'approved' ? 'You’re in' : 'Application sent', r.status === 'approved' ? `${o.brand} has you in ${o.name}. It’s now under Earnings.` : `The ${o.brand} team will review it. It’s under Invites until they do.`);
    } catch (e) { Alert.alert('Couldn’t join', errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <Head brand={o.brand} logo={o.logo} eyebrow={`${o.brand} · ${o.kind === 'program' ? 'Commission program' : 'Deal offer'}`} title={o.name} pill={<Pill text={o.approval === 'auto' ? 'Open' : 'Apply'} tone="lime" />} />
      <Text style={S.big}>{o.summary}</Text>
      <Text style={S.muted}>Runs on {o.platforms.map((p) => (p === 'tiktok' ? 'TikTok Shop' : 'Facebook + Instagram ads')).join(' and ')}.</Text>
      {o.description ? <Text style={S.body2}>{o.description}</Text> : null}
      <View style={{ marginTop: 12, gap: 10 }}>
        <Consent checked={ok} onToggle={() => setOk((v) => !v)} text={`I agree to the terms${o.platforms.includes('meta') ? `, and ${o.brand} can run my authorized videos as Facebook and Instagram ads` : ''}.`} />
        <Btn label={o.approval === 'auto' ? (o.kind === 'program' ? 'Join program' : 'Accept deal') : 'Apply'} onPress={join} busy={busy} disabled={!ok} />
      </View>
    </Card>
  );
}

// Agreements are signed on HQ's web page only (Brandon's rule). The app shows
// status, opens the sign page, and downloads the signed PDF.
async function openAgreementPdf(id: string) {
  try {
    const r = await programsAction({ action: 'agreement-pdf', agreementId: id });
    if (!r.url) throw new Error('No PDF yet');
    await WebBrowser.openBrowserAsync(r.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch (e) { Alert.alert('Couldn’t open the PDF', errMsg(e)); }
}

function AgreementCard({ a }: { a: NonNullable<ProgramsHome['agreements']>[number] }) {
  const sign = async () => {
    haptic.tap();
    // System browser on purpose (HQ's request): the post-sign page links to the App Store and a PDF.
    if (a.signUrl) { await Linking.openURL(a.signUrl); return; }
    Alert.alert('Sign on the web', `Open the email from contracts@influenceish.com titled “${a.title}” and sign there. Once it’s signed, set up payouts here.`);
  };
  return (
    <Card>
      <Head brand={a.brand || 'Influenceish'} eyebrow={`${a.brand ? `${a.brand} · ` : ''}Agreement`} title={a.title} pill={<Pill text={a.status === 'viewed' ? 'Viewed' : 'To sign'} tone="coral" />} />
      <Text style={S.big}>Review and sign on the web before this deal starts.</Text>
      <Text style={S.muted}>Sent {a.sentAt ? new Date(a.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently'} · ref {a.ref}</Text>
      <View style={{ marginTop: 12 }}><Btn label={a.signUrl ? 'Sign on the web' : 'Where to sign'} onPress={sign} /></View>
    </Card>
  );
}

function SignedAgreements({ list }: { list: NonNullable<ProgramsHome['agreements']> }) {
  return (
    <Card>
      <View style={S.rowHead}>
        <View style={[S.smallIcon, { backgroundColor: D.ink }]}><FileSignature size={16} color="#FFF" strokeWidth={2.2} /></View>
        <View style={{ flex: 1 }}><Text style={S.cardTitle}>Agreements</Text><Text style={S.muted}>Signed copies of your brand agreements.</Text></View>
      </View>
      {list.map((a) => (
        <TouchableOpacity key={a.id} style={S.subRow} onPress={() => openAgreementPdf(a.id)} activeOpacity={0.8}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={S.subBrand} numberOfLines={1}>{a.title}</Text>
            <Text style={S.muted} numberOfLines={1}>{a.brand ? `${a.brand} · ` : ''}signed {a.signedAt ? new Date(a.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}{a.status === 'countersigned' ? ' · countersigned' : ''}</Text>
          </View>
          <FileDown size={16} color={D.textMuted} strokeWidth={2.2} />
        </TouchableOpacity>
      ))}
    </Card>
  );
}

// Commission tracker: what every active program and deal has earned, what is
// ready to pay out, what is still in the holding window, and what was sent.
function Tracker({ d, active }: { d: ProgramsHome; active: { programs: ProgramsHome['programs']; deals: ProgramsHome['deals'] } }) {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const progAll = active.programs.map((p) => p.earningsAllTime ?? p.earnings);
  const earned = sum(progAll.map((e) => e?.earned ?? 0)) + sum(active.deals.map((x) => x.earned));
  const ready = sum(progAll.map((e) => e?.eligible ?? 0)) + sum(active.deals.map((x) => x.owed));
  const pending = sum(progAll.map((e) => e?.pending ?? 0));
  const paid = sum(d.payouts.filter((p) => p.status === 'paid').map((p) => p.amount));
  const last30 = sum(active.programs.map((p) => p.earnings?.earned ?? 0));
  const orders = sum(progAll.map((e) => e?.orders ?? 0));
  const sales = sum(progAll.map((e) => e?.sales ?? 0));
  const nextPayout = active.programs.map((p) => p.program.nextPayoutDate).filter((v): v is string => !!v).sort()[0] ?? null;
  return (
    <Card style={{ backgroundColor: D.ink, borderColor: D.ink }}>
      <View style={S.rowHead}>
        <View style={[S.smallIcon, { backgroundColor: D.lime }]}><TrendingUp size={16} color={D.ink} strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[S.cardTitle, { color: '#FFF' }]}>Commission tracker</Text>
          <Text style={[S.muted, { color: 'rgba(255,255,255,0.6)' }]}>{active.programs.length} program{active.programs.length === 1 ? '' : 's'} · {active.deals.length} deal{active.deals.length === 1 ? '' : 's'}</Text>
        </View>
      </View>
      <Text style={S.trackBig}>{money(earned)}</Text>
      <Text style={[S.muted, { color: 'rgba(255,255,255,0.6)', marginTop: 0 }]}>earned all time · {money(last30)} in the last 30 days{nextPayout ? ` · next payout ${shortDate(nextPayout)}` : ''}</Text>
      <View style={S.stats}>
        <View style={[S.stat, S.statDark]}><Text style={[S.statLabel, { color: 'rgba(255,255,255,0.55)' }]}>READY</Text><Text style={[S.statVal, { color: D.lime }]}>{money(ready)}</Text></View>
        <View style={[S.stat, S.statDark]}><Text style={[S.statLabel, { color: 'rgba(255,255,255,0.55)' }]}>PENDING</Text><Text style={[S.statVal, { color: '#FFF' }]}>{money(pending)}</Text></View>
        <View style={[S.stat, S.statDark]}><Text style={[S.statLabel, { color: 'rgba(255,255,255,0.55)' }]}>PAID OUT</Text><Text style={[S.statVal, { color: '#FFF' }]}>{money(paid)}</Text></View>
      </View>
      {(orders > 0 || sales > 0) && <Text style={[S.hint, { color: 'rgba(255,255,255,0.5)', marginTop: 10 }]}>{orders.toLocaleString()} orders · {money(sales)} in attributed sales. Pending clears after each program’s holding window.</Text>}
      {!active.programs.length && !active.deals.length && <Text style={[S.hint, { color: 'rgba(255,255,255,0.5)', marginTop: 10 }]}>Join a program under Open, or accept an invite, and your commissions show up here.</Text>}
    </Card>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[S.card, style]}>{children}</View>;
}

function Pill({ text, tone }: { text: string; tone: 'lime' | 'coral' | 'muted' }) {
  const bg = tone === 'lime' ? D.lime : tone === 'coral' ? D.coral : D.surface;
  const fg = tone === 'coral' ? '#FFF' : tone === 'lime' ? D.ink : D.textMuted;
  return <View style={[S.pill, { backgroundColor: bg }]}><Text style={[S.pillText, { color: fg }]}>{text}</Text></View>;
}

function Head({ brand, logo, eyebrow, title, pill }: { brand: string; logo?: string | null; eyebrow: string; title: string; pill: React.ReactNode }) {
  return (
    <View style={S.head}>
      {logo ? <Image source={{ uri: logo }} style={S.logo} /> : <View style={[S.logo, S.logoPh]}><Text style={S.logoText}>{brand[0]}</Text></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={S.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        <Text style={S.cardTitle} numberOfLines={2}>{title}</Text>
      </View>
      {pill}
    </View>
  );
}

function Consent({ checked, onToggle, text }: { checked: boolean; onToggle: () => void; text: string }) {
  return (
    <TouchableOpacity style={S.consent} onPress={onToggle} activeOpacity={0.8}>
      <View style={[S.box, checked && S.boxOn]}>{checked && <Check size={12} color="#FFF" strokeWidth={3} />}</View>
      <Text style={S.consentText}>{text}</Text>
    </TouchableOpacity>
  );
}

function Btn({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <AnimatedPressable haptic="medium" onPress={disabled || busy ? undefined : onPress} style={[S.btn, (disabled || busy) && { opacity: 0.5 }]}>
      <LinearGradient colors={[D.coral, D.coralWarm]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.btnFill}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={S.btnText}>{label}</Text>}
      </LinearGradient>
    </AnimatedPressable>
  );
}

function OfferCard({ o, onDone }: { o: ProgramsHome['offers'][number]; onDone: () => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try { await programsAction({ action: 'accept_offer', memberId: o.memberId }); haptic.success(); onDone(); }
    catch (e) { Alert.alert('Couldn’t accept', errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <Head brand={o.brand} logo={o.logo} eyebrow={`${o.brand} · Deal offer`} title={o.name} pill={<Pill text={o.status === 'invited' ? 'Invited' : 'In review'} tone={o.status === 'invited' ? 'coral' : 'muted'} />} />
      <Text style={S.big}>{o.summary}{o.durationDays ? ` · ${o.durationDays} days` : ''}</Text>
      <Text style={S.muted}>Runs on {o.platforms.map((p) => (p === 'tiktok' ? 'TikTok Shop' : 'Facebook + Instagram ads')).join(' and ')}.</Text>
      {o.description ? <Text style={S.body2}>{o.description}</Text> : null}
      {o.status === 'pending' ? (
        <Text style={S.note}>The {o.brand} team is reviewing your application.</Text>
      ) : (
        <View style={{ marginTop: 12, gap: 10 }}>
          <Consent checked={ok} onToggle={() => setOk((v) => !v)} text={`I agree to the deal terms${o.platforms.includes('meta') ? `, and ${o.brand} can run my videos as Facebook and Instagram ads` : ''}.`} />
          <Btn label="Accept deal" onPress={accept} busy={busy} disabled={!ok} />
        </View>
      )}
    </Card>
  );
}

function DealCard({ d }: { d: ProgramsHome['deals'][number] }) {
  const terms = d.type === 'package' ? `${money(Number(d.totalAmount) || 0)} for ${d.videoTarget ?? 0} videos`
    : d.type === 'per_video' ? `${money(Number(d.perVideoRate) || 0)} per video` : `${money(Number(d.totalAmount) || 0)} per month`;
  return (
    <Card>
      <Head brand={d.brand} eyebrow={d.brand} title={`${DEAL_LABEL[d.type]} · ${terms}`} pill={<Pill text={d.status === 'active' ? 'Active' : 'Completed'} tone={d.status === 'active' ? 'lime' : 'muted'} />} />
      <View style={S.stats}>
        <View style={S.stat}><Text style={S.statLabel}>EARNED</Text><Text style={S.statVal}>{money(d.earned)}</Text></View>
        <View style={S.stat}><Text style={S.statLabel}>PAID</Text><Text style={S.statVal}>{money(d.paid)}</Text></View>
        <View style={[S.stat, { backgroundColor: D.ink }]}><Text style={[S.statLabel, { color: 'rgba(255,255,255,0.55)' }]}>COMING</Text><Text style={[S.statVal, { color: D.lime }]}>{money(d.owed)}</Text></View>
      </View>
      {d.type !== 'retainer' && <Text style={[S.muted, { marginTop: 8 }]}>{d.delivered}{d.type === 'package' && d.videoTarget ? ` of ${d.videoTarget}` : ''} videos counted</Text>}
      {d.agreement?.needsSignature ? (
        <TouchableOpacity style={S.note} onPress={() => { haptic.tap(); if (d.agreement?.signUrl) Linking.openURL(d.agreement.signUrl); }} activeOpacity={0.8}>
          <Text style={[S.muted, { color: D.textSecondary, marginTop: 0 }]}>{d.lockedAmount ? `${money(d.lockedAmount)} is locked until you sign the agreement.` : 'Payment is locked until you sign the agreement.'}{d.agreement?.signUrl ? ' Tap to sign on the web.' : ' Check your email to sign.'}</Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}

function ProgramCard({ p, onDone }: { p: ProgramsHome['programs'][number]; onDone: () => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const x = p.program;
  const join = async () => {
    setBusy(true);
    try { await programsAction({ action: 'agree', enrollmentId: p.enrollmentId }); haptic.success(); onDone(); }
    catch (e) { Alert.alert('Couldn’t join', errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <Head brand={x.brand} logo={x.logo} eyebrow={x.brand} title={x.name}
        pill={<Pill text={p.status === 'active' ? 'Joined' : p.status === 'pending' ? 'In review' : 'Invited'} tone={p.status === 'active' ? 'lime' : p.status === 'pending' ? 'muted' : 'coral'} />} />
      <Text style={S.big}>You earn {x.rate}% of the {x.basis === 'sales_pct' ? 'sales from' : 'ad spend behind'} ads using your videos.</Text>
      <Text style={S.muted}>Paid {x.cadence} · {x.holdingDays}-day hold for returns{x.monthlyCap != null ? ` · capped at ${money(x.monthlyCap)}/mo` : ''}</Text>
      {p.status === 'active' && (x.nextPayoutDate || x.capReached) ? (
        <View style={S.payoutLine}>
          <Text style={S.muted}>{x.nextPayoutDate ? `Next payout ${shortDate(x.nextPayoutDate)}` : ''}{x.nextPayoutDate && x.capReached ? ' · ' : ''}</Text>
          {x.capReached ? <Pill text="Monthly cap reached" tone="muted" /> : null}
        </View>
      ) : null}
      {p.status === 'active' && p.discountCode ? <CodeRow code={p.discountCode.code} percent={p.discountCode.percent} brand={x.brand} /> : null}
      {p.status === 'active' && p.viaCode && (p.viaCode.sales > 0 || p.viaCode.orders > 0) ? (
        <Text style={[S.muted, { marginTop: 8 }]}>Via your code: {money(p.viaCode.sales)} in sales · {p.viaCode.orders} order{p.viaCode.orders === 1 ? '' : 's'} · {money(p.viaCode.commission)} commission</Text>
      ) : null}
      {p.status === 'active' && p.ads && p.ads.length > 0 ? <AdsList ads={p.ads} basis={x.basis} /> : null}
      {p.status === 'active' && p.earnings && (
        <View style={S.stats}>
          <View style={S.stat}><Text style={S.statLabel}>30 DAYS</Text><Text style={S.statVal}>{money(p.earnings.earned)}</Text></View>
          <View style={[S.stat, { backgroundColor: D.ink }]}><Text style={[S.statLabel, { color: 'rgba(255,255,255,0.55)' }]}>READY</Text><Text style={[S.statVal, { color: D.lime }]}>{money(p.earnings.eligible)}</Text></View>
          <View style={S.stat}><Text style={S.statLabel}>PENDING</Text><Text style={S.statVal}>{money(p.earnings.pending)}</Text></View>
        </View>
      )}
      {x.terms ? (
        <TouchableOpacity onPress={() => setTerms((v) => !v)} style={S.termsBtn} activeOpacity={0.7}>
          <ChevronDown size={14} color={D.textSecondary} style={{ transform: [{ rotate: terms ? '180deg' : '0deg' }] }} /><Text style={S.termsText}>Program terms</Text>
        </TouchableOpacity>
      ) : null}
      {terms && x.terms ? <Text style={S.termsBody}>{x.terms}</Text> : null}
      {p.status === 'pending' && <Text style={S.note}>The {x.brand} team is reviewing your application.</Text>}
      {p.status === 'invited' && (
        <View style={{ marginTop: 12, gap: 10 }}>
          <Consent checked={ok} onToggle={() => setOk((v) => !v)} text={`I agree to the program terms, and ${x.brand} can run my submitted videos as Facebook and Instagram ads.`} />
          <Btn label="Join program" onPress={join} busy={busy} disabled={!ok} />
        </View>
      )}
    </Card>
  );
}

// The creator's discount code for a brand: sales with the code are credited to
// them even when the order carries no ad tag.
function CodeRow({ code, percent, brand }: { code: string; percent: number; brand: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptic.success(); setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <TouchableOpacity style={S.codeRow} onPress={copy} activeOpacity={0.85}>
      <View style={S.codeIcon}><Tag size={14} color={D.ink} strokeWidth={2.4} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={S.codeText} numberOfLines={1}>{code}</Text>
        <Text style={S.muted} numberOfLines={1}>{percent ? `${percent}% off for your audience · ` : ''}sales with your code count toward your {brand} commission</Text>
      </View>
      <View style={[S.copyBtn, copied && { backgroundColor: D.limeDeep }]}>
        {copied ? <Check size={13} color="#FFF" strokeWidth={3} /> : <Copy size={13} color="#FFF" strokeWidth={2.4} />}
        <Text style={S.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Which ad (or video) earned what: HQ's per-ad breakdown for the program.
function AdsList({ ads, basis }: { ads: NonNullable<ProgramsHome['programs'][number]['ads']>; basis: 'sales_pct' | 'spend_pct' }) {
  const [open, setOpen] = useState(false);
  const sorted = [...ads].sort((a, b) => b.commission - a.commission);
  const shown = open ? sorted : sorted.slice(0, 3);
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={S.fieldLabel}>ADS USING YOUR VIDEOS · {ads.length}</Text>
      {shown.map((a) => (
        <View key={a.id} style={S.adRow}>
          {a.thumbnail ? <Image source={{ uri: a.thumbnail }} style={S.adThumb} /> : <View style={[S.adThumb, { backgroundColor: D.surface }]} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={S.adName} numberOfLines={1}>{a.name}</Text>
            <Text style={S.muted} numberOfLines={1}>{basis === 'spend_pct' ? `${money(a.spend)} spend` : `${money(a.sales)} sales · ${a.orders} order${a.orders === 1 ? '' : 's'}`} · since {new Date(a.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.adAmt}>{money(a.commission)}</Text>
            <Text style={S.muted}>{a.pending > 0 ? `${money(a.pending)} pending` : 'ready'}</Text>
          </View>
        </View>
      ))}
      {ads.length > 3 && (
        <TouchableOpacity onPress={() => setOpen((v) => !v)} style={S.termsBtn} activeOpacity={0.7}>
          <ChevronDown size={14} color={D.textSecondary} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} /><Text style={S.termsText}>{open ? 'Show fewer' : `Show all ${ads.length}`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ChallengeCard({ c, onDone }: { c: ProgramsHome['challenges'][number]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const unit = c.type === 'gmv' ? 'in GMV' : c.type === 'videos' ? 'videos' : 'orders';
  const fmt = (n: number) => (c.type === 'gmv' ? money(n) : n.toLocaleString());
  const pct = c.goal > 0 ? Math.min(100, Math.round((c.progress / c.goal) * 100)) : 0;
  const join = async () => {
    setBusy(true);
    try { await programsAction({ action: 'join_challenge', challengeId: c.id }); haptic.success(); onDone(); }
    catch (e) { Alert.alert('Couldn’t join', errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <Head brand={c.brand || 'B'} eyebrow={`${c.brand ? `${c.brand} · ` : ''}Bonus challenge`} title={c.title} pill={<Pill text={c.reward} tone="lime" />} />
      <Text style={S.big}>Hit {fmt(c.goal)} {unit} by {new Date(`${c.endsOn}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</Text>
      {c.description ? <Text style={S.body2}>{c.description}</Text> : null}
      {c.joined ? (
        <View style={{ marginTop: 12 }}>
          <View style={S.track}><LinearGradient colors={[D.coral, D.coralWarm]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[S.fill, { width: `${pct}%` }]} /></View>
          <Text style={[S.muted, { marginTop: 6 }]}>{c.completed ? (c.rewardClaimed ? 'Completed · reward sent' : 'Completed · reward on the way') : `${fmt(c.progress)} of ${fmt(c.goal)} (${pct}%)`}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}><Btn label="Join challenge" onPress={join} busy={busy} /></View>
      )}
    </Card>
  );
}

function AuthorizeVideo({ d, onDone }: { d: ProgramsHome; onDone: () => void }) {
  const [storeId, setStoreId] = useState(d.submitBrands[0]?.id ?? '');
  const [platform, setPlatform] = useState<'tiktok' | 'instagram'>('tiktok');
  const [permalink, setPermalink] = useState('');
  const [adCode, setAdCode] = useState('');
  const [instagram, setInstagram] = useState('');
  const [busy, setBusy] = useState(false);
  const linkOk = !permalink.trim() || (platform === 'tiktok' ? /tiktok\.com/i.test(permalink) : /instagram\.com/i.test(permalink));
  const send = async () => {
    setBusy(true);
    try {
      await programsAction({ action: 'submit_post', storeId, permalink: permalink.trim() || undefined, adCode: adCode.trim() || undefined, instagram: platform === 'instagram' ? (instagram.trim() || undefined) : undefined, note: platform === 'tiktok' ? 'TikTok Spark Ads authorization' : undefined });
      haptic.success(); setPermalink(''); setAdCode(''); onDone();
      Alert.alert('Authorized', 'The brand can now run this video as an ad. You’ll see it under the list below once it’s live.');
    } catch (e) { Alert.alert('Couldn’t authorize', errMsg(e)); }
    finally { setBusy(false); }
  };
  const STATUS = { submitted: 'In review', launched: 'Running as an ad', declined: 'Not used' } as const;
  const brand = d.submitBrands.find((b) => b.id === storeId)?.name ?? 'the brand';
  return (
    <>
      <Card>
        <View style={S.rowHead}>
          <View style={S.smallIcon}><Megaphone size={16} color="#FFF" strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={S.cardTitle}>Authorize a video</Text>
            <Text style={S.muted}>Let a brand run one of your videos as an ad from your handle. Sales it drives count toward your commissions.</Text>
          </View>
        </View>
        <View style={{ gap: 10, marginTop: 14 }}>
          <Text style={S.fieldLabel}>BRAND</Text>
          <View style={S.chips}>
            {d.submitBrands.map((b) => (
              <TouchableOpacity key={b.id} onPress={() => { haptic.select(); setStoreId(b.id); }} style={[S.chip, storeId === b.id && S.chipOn]} activeOpacity={0.8}>
                <Text style={[S.chipText, storeId === b.id && { color: '#FFF' }]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={S.fieldLabel}>PLATFORM</Text>
          <View style={S.chips}>
            {(['tiktok', 'instagram'] as const).map((p) => (
              <TouchableOpacity key={p} onPress={() => { haptic.select(); setPlatform(p); setPermalink(''); setAdCode(''); }} style={[S.chip, platform === p && S.chipOn]} activeOpacity={0.8}>
                <Text style={[S.chipText, platform === p && { color: '#FFF' }]}>{p === 'tiktok' ? 'TikTok' : 'Instagram'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={permalink} onChangeText={setPermalink} placeholder={platform === 'tiktok' ? 'TikTok video link' : 'Instagram post link'} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholderTextColor={D.textMuted} style={[S.input, !linkOk && { borderColor: D.coral }]} />
          <TextInput value={adCode} onChangeText={setAdCode} placeholder={platform === 'tiktok' ? 'Spark Ads authorization code' : 'Partnership ad code'} autoCapitalize="none" autoCorrect={false} placeholderTextColor={D.textMuted} style={S.input} />
          {platform === 'tiktok' ? (
            <Text style={S.hint}>In TikTok: open the video → ⋯ → Ad settings → turn on Ad authorization → pick how long {brand} can use it → Generate code → copy it.</Text>
          ) : (
            <>
              <Text style={S.hint}>In Instagram: open the post → ⋯ → Partnership label and ads → turn on Partnership ad code → copy it.</Text>
              <TextInput value={instagram} onChangeText={setInstagram} placeholder="@yourinstagram" autoCapitalize="none" autoCorrect={false} placeholderTextColor={D.textMuted} style={S.input} />
            </>
          )}
          <Btn label={`Authorize for ${brand}`} onPress={send} busy={busy} disabled={!storeId || !linkOk || (!permalink.trim() && !adCode.trim())} />
        </View>
      </Card>
      {d.submissions.length > 0 && (
        <Card>
          <Text style={S.cardTitle}>Authorized videos</Text>
          {d.submissions.map((s) => (
            <View key={s.id} style={S.subRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.subBrand} numberOfLines={1}>{s.brand}</Text>
                <Text style={S.muted} numberOfLines={1}>{s.platform === 'tiktok' ? 'TikTok' : 'Instagram'}{s.hasCode ? ' · code attached' : ''} · {new Date(s.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                {s.ad && (s.ad.sales != null || s.ad.spend != null) ? (
                  <Text style={S.muted} numberOfLines={1}>{s.ad.sales != null ? `${money(s.ad.sales)} sales` : ''}{s.ad.sales != null && s.ad.orders != null ? ` · ${s.ad.orders} orders` : ''}{s.ad.spend != null ? `${s.ad.sales != null ? ' · ' : ''}${money(s.ad.spend)} spend` : ''}</Text>
                ) : null}
                {s.reviewNote ? <Text style={S.reviewNote}>{s.brand} team: “{s.reviewNote}”</Text> : null}
              </View>
              <Pill text={STATUS[s.status]} tone={s.status === 'launched' ? 'lime' : 'muted'} />
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Payments({ d }: { d: ProgramsHome }) {
  return (
    <Card>
      <Text style={S.cardTitle}>Payments</Text>
      {d.payouts.map((p, i) => (
        <View key={i} style={S.payRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.payLabel}>{p.label}</Text>
            <Text style={S.muted}>{new Date(p.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {p.method === 'stripe' ? 'Bank deposit' : 'PayPal'}</Text>
          </View>
          <Text style={S.payAmt}>{money(p.amount)}</Text>
          <Pill text={p.status === 'paid' ? 'Sent' : 'Sending'} tone={p.status === 'paid' ? 'lime' : 'muted'} />
        </View>
      ))}
    </Card>
  );
}

function Payout({ d, onDone }: { d: ProgramsHome; onDone: () => void }) {
  const pr = d.profile;
  const ready = pr?.method === 'stripe' ? pr.stripeReady : pr?.method === 'paypal' ? !!pr.paypalEmail : false;
  const router = useRouter();
  const open = () => { haptic.tap(); router.push('/payouts' as any); };
  return (
    <Card>
      <View style={S.rowHead}>
        <View style={[S.smallIcon, { backgroundColor: ready ? D.limeDeep : D.coral }]}><Wallet size={16} color="#FFF" strokeWidth={2.2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={S.cardTitle}>How you get paid</Text>
          <Text style={S.muted}>{ready ? `Set up: ${pr?.method === 'stripe' ? 'bank deposit via Stripe' : 'PayPal'}` : 'Add a bank account or PayPal to receive payments.'}</Text>
        </View>
      </View>
      {d.formula?.payoutsBlockedReason ? (
        <Text style={S.note}>{d.formula.payoutsBlockedReason}</Text>
      ) : (
        <View style={{ marginTop: 12 }}><Btn label={ready ? 'Manage payout details' : 'Set up payouts'} onPress={open} /></View>
      )}
      <Text style={[S.hint, { marginTop: 10 }]}>Bank details are handled by Stripe or PayPal. Influenceish never sees them.</Text>
    </Card>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingHorizontal: 16 },
  pageHead: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8, lineHeight: 34 },
  sub: { ...T.regular, fontSize: 14, color: D.textMuted, marginTop: 4 },
  heroWrap: { borderRadius: 22, overflow: 'hidden', ...Shadow.coral, marginBottom: 14 },
  hero: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  circleA: { position: 'absolute', right: -50, bottom: -70, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.13)' },
  circleB: { position: 'absolute', right: -90, top: -90, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  heroEyebrow: { ...T.bold, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', letterSpacing: 1.1, textTransform: 'uppercase' },
  eyebrow: { ...T.bold, fontSize: 10.5, color: D.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroHeadline: { ...T.bold, fontSize: 26, color: '#fff', lineHeight: 31, letterSpacing: -0.4, marginBottom: 10, maxWidth: '84%' },
  heroSub: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18, maxWidth: '88%' },
  segWrap: { marginBottom: 14 },
  seg: { flexDirection: 'row', backgroundColor: D.card, borderWidth: 1, borderColor: D.border, borderRadius: R.full, padding: 4 },
  segPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: R.full, backgroundColor: D.ink },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: R.full },
  segTxt: { ...T.bold, fontSize: 13, color: D.textMuted },
  segTxtOn: { color: '#FFF' },
  segNum: { ...T.medium, fontSize: 11.5, color: D.textDisabled },
  segNumOn: { color: 'rgba(255,255,255,0.7)' },
  fieldLabel: { ...T.bold, fontSize: 10.5, color: D.textMuted, letterSpacing: 0.8 },
  sectionLabel: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.8, marginTop: 6, marginBottom: -4, marginLeft: 4 },
  subTabs: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  subTab: { borderRadius: R.full, borderWidth: 1, borderColor: D.border, backgroundColor: D.card, paddingHorizontal: 14, paddingVertical: 8 },
  subTabOn: { backgroundColor: D.ink, borderColor: D.ink },
  subTabText: { ...T.bold, fontSize: 13, color: D.textSecondary },
  subTabTextOn: { color: '#FFF' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.card, borderRadius: 18, borderWidth: 1, borderColor: D.border, padding: 14 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.lime, borderRadius: 18, padding: 14 },
  nudgeIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  nudgeTitle: { ...T.bold, fontSize: 14.5, color: D.ink, letterSpacing: -0.2 },
  nudgeSub: { ...T.regular, fontSize: 12.5, color: 'rgba(26,20,38,0.7)', marginTop: 2, lineHeight: 17 },
  nudgeCta: { ...T.bold, fontSize: 13.5, color: '#FFF', backgroundColor: D.ink, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 8, overflow: 'hidden' },
  payoutLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  adRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: D.inkHairline, paddingTop: 10, marginTop: 10 },
  adThumb: { width: 40, height: 52, borderRadius: 8, backgroundColor: D.surface },
  adName: { ...T.bold, fontSize: 13.5, color: D.textPrimary },
  adAmt: { ...T.bold, fontSize: 14.5, color: D.textPrimary },
  reviewNote: { ...T.regular, fontSize: 12.5, color: D.textSecondary, lineHeight: 17, marginTop: 4, fontStyle: 'italic' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: D.lime, borderRadius: 14, padding: 10 },
  codeIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  codeText: { ...T.bold, fontSize: 16, color: D.ink, letterSpacing: 0.6 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: D.ink, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 7 },
  copyText: { ...T.bold, fontSize: 12, color: '#FFF' },
  trackBig: { ...T.bold, fontSize: 34, color: '#FFF', letterSpacing: -1, marginTop: 14 },
  statDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  body: { gap: 12 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 16 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  logoPh: { backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center' },
  logoText: { ...T.bold, color: D.coral, fontSize: 16 },
  cardTitle: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3 },
  big: { ...T.bold, fontSize: 15, color: D.textPrimary, lineHeight: 21 },
  body2: { ...T.regular, fontSize: 13.5, color: D.textSecondary, lineHeight: 19, marginTop: 8 },
  muted: { ...T.regular, fontSize: 12.5, color: D.textMuted, lineHeight: 17, marginTop: 2 },
  note: { ...T.regular, fontSize: 13, color: D.textSecondary, backgroundColor: D.surface, borderRadius: 12, padding: 12, marginTop: 12, lineHeight: 18 },
  hint: { ...T.regular, fontSize: 11.5, color: D.textMuted, lineHeight: 16 },
  pill: { borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'center' },
  pillText: { ...T.bold, fontSize: 11 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: D.surface, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  statLabel: { ...T.bold, fontSize: 9.5, color: D.textMuted, letterSpacing: 0.6 },
  statVal: { ...T.bold, fontSize: 16, color: D.textPrimary, marginTop: 2, letterSpacing: -0.3 },
  consent: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: D.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: D.coral, borderColor: D.coral },
  consentText: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 18, flex: 1 },
  btn: { borderRadius: R.full, overflow: 'hidden' },
  btnFill: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { ...T.bold, fontSize: 15, color: '#FFF' },
  termsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  termsText: { ...T.bold, fontSize: 12.5, color: D.textSecondary },
  termsBody: { ...T.regular, fontSize: 12.5, color: D.textSecondary, lineHeight: 18, backgroundColor: D.surface, borderRadius: 12, padding: 12, marginTop: 8 },
  rowHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  smallIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center' },
  dashed: { marginTop: 14, height: 46, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  dashedText: { ...T.bold, fontSize: 14, color: D.coral },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: R.full, borderWidth: 1, borderColor: D.border, backgroundColor: D.card, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: D.ink, borderColor: D.ink },
  chipText: { ...T.bold, fontSize: 12.5, color: D.textSecondary },
  input: { ...T.regular, height: 46, borderRadius: 14, borderWidth: 1, borderColor: D.border, paddingHorizontal: 14, fontSize: 15, color: D.textPrimary, backgroundColor: D.card },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: D.inkHairline, paddingTop: 10, marginTop: 10 },
  subBrand: { ...T.medium, fontSize: 13, color: D.textPrimary, flex: 1 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: D.inkHairline, paddingTop: 10, marginTop: 10 },
  payLabel: { ...T.bold, fontSize: 13.5, color: D.textPrimary },
  payAmt: { ...T.bold, fontSize: 15, color: D.textPrimary },
  track: { height: 8, borderRadius: 4, backgroundColor: D.surface, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
