// Turns the raw creator brain (speech / pacing / style / scores) into things a
// creator can actually learn from: a named archetype, benchmarked insights,
// explained hooks and a short playbook. Pure functions — no React, no I/O.

import type { CreatorProfile, SpeechTemplate, PacingTemplate, VideoStyleProfile } from '@/types/api';

// "Typical creator" reference points for short-form talking video. These are
// conventional norms (conversational speech ≈150 wpm, ~3s to earn a view,
// ~25–30s shop videos, ~1 cut every 6s) — not per-creator index data.
export const TYPICAL = {
  wpm: 150,
  hookSec: 3,
  lengthSec: 27,
  cutsPer30: 5,
  energy: 55,
  authenticity: 60,
  viral: 50,
};

export type InsightKey = 'pace' | 'hook' | 'length' | 'cuts' | 'energy' | 'real' | 'oncamera' | 'viral';

export interface Insight {
  key: InsightKey;
  label: string;          // "Talking speed"
  value: string;          // "245"
  unit?: string;          // "wpm"
  you: number;            // for the comparison bar
  typical: number;
  typicalLabel: string;   // "150 wpm"
  headline: string;       // "You talk 63% faster than a typical creator."
  meaning: string;        // what it says about them
  why: string;            // why it matters for views / sales
  tip: string;            // one thing to try
}

const pctDiff = (you: number, typ: number) => Math.round(((you - typ) / typ) * 100);
const cmp = (you: number, typ: number, tol = 8) => {
  const d = pctDiff(you, typ);
  if (Math.abs(d) <= tol) return { word: 'right around', d: 0 };
  return d > 0 ? { word: `${d}% faster than`, d } : { word: `${Math.abs(d)}% slower than`, d };
};
const sec = (n: number) => (Number.isInteger(n) ? `${n}s` : `${n.toFixed(1)}s`);

export function buildInsights(
  profile: CreatorProfile,
  speech: SpeechTemplate | null,
  pacing: PacingTemplate | null,
  style: VideoStyleProfile | null,
): Insight[] {
  const out: Insight[] = [];

  if (speech?.avg_wpm != null && speech.avg_wpm > 0) {
    const w = speech.avg_wpm;
    const c = cmp(w, TYPICAL.wpm);
    out.push({
      key: 'pace', label: 'Talking speed', value: String(w), unit: 'wpm',
      you: w, typical: TYPICAL.wpm, typicalLabel: `${TYPICAL.wpm} wpm`,
      headline: c.d === 0 ? 'You talk at a natural, conversational speed.' : `You talk ${c.word} a typical creator.`,
      meaning: w >= 200
        ? 'This is rapid-fire. It reads as confident and urgent — people feel they might miss something if they scroll.'
        : w >= 165
          ? 'Quick and punchy. It keeps energy up without feeling rushed.'
          : w < 125
            ? 'Calm and deliberate. Every word gets room to land, which builds trust.'
            : 'Easy to follow. It sounds like a friend talking, not a pitch.',
      why: w >= 200
        ? 'Fast delivery holds attention, but product benefits can blur past. Viewers buy what they can repeat back.'
        : 'Pace sets the mood of the whole video before anyone processes a word.',
      tip: w >= 200
        ? 'Keep the speed, but slow down for one beat on the single benefit you most want remembered.'
        : w < 125
          ? 'Try one line delivered faster right before your ask — the contrast makes it feel urgent.'
          : 'Lean into it: your scripts should read like you\'re talking to one person.',
    });
  }

  if (pacing?.avg_hook_duration_sec != null && pacing.avg_hook_duration_sec > 0) {
    const h = pacing.avg_hook_duration_sec;
    const fast = h <= 4;
    out.push({
      key: 'hook', label: 'Hook window', value: sec(h),
      you: h, typical: TYPICAL.hookSec, typicalLabel: `${TYPICAL.hookSec}s`,
      headline: fast ? `You make your point in the first ${sec(h)}.` : `You take ${sec(h)} to get to the point.`,
      meaning: fast
        ? 'You get to the point before people decide to scroll. That\'s the single hardest thing to do on camera.'
        : 'Your setup runs a little long before the payoff arrives.',
      why: 'Most viewers decide to stay or scroll inside about 3 seconds. Everything after that only matters if they\'re still there.',
      tip: fast
        ? 'Protect this. Never open with "hey guys" or a greeting — your first line should be the hook itself.'
        : 'Cut the greeting. Start on the line you\'d normally say at second 4, and let the context come after.',
    });
  }

  if (pacing?.avg_video_length_sec != null && pacing.avg_video_length_sec > 0) {
    const l = pacing.avg_video_length_sec;
    const short = l <= 18;
    out.push({
      key: 'length', label: 'Video length', value: sec(l),
      you: l, typical: TYPICAL.lengthSec, typicalLabel: `${TYPICAL.lengthSec}s`,
      headline: short ? 'Your videos are short and to the point.' : l >= 40 ? 'You give your videos room to breathe.' : 'Your videos sit in the sweet spot for shop content.',
      meaning: short
        ? 'You say what you need and get out. Watch-through rates on videos this length tend to be high.'
        : l >= 40
          ? 'Longer runs let you demo and explain — great for products that need proof.'
          : 'Long enough to show the product, short enough to keep watch-through high.',
      why: 'Watch-through is one of the strongest signals for reach. Every second past the point has to earn its place.',
      tip: short
        ? 'You have room to add one proof moment (a result, a before/after) without hurting watch-through.'
        : 'Try cutting your least-necessary 5 seconds and see if watch-through climbs.',
    });
  }

  if (pacing?.cuts_per_30s != null && pacing.cuts_per_30s > 0) {
    const c = pacing.cuts_per_30s;
    const quick = c >= 7;
    out.push({
      key: 'cuts', label: 'Cut rate', value: `${Math.round(c)}`, unit: 'per 30s',
      you: c, typical: TYPICAL.cutsPer30, typicalLabel: `${TYPICAL.cutsPer30} per 30s`,
      headline: quick ? 'You cut fast — a new shot every few seconds.' : c <= 3 ? 'You hold your shots.' : 'You keep a steady, even rhythm.',
      meaning: quick
        ? 'Quick cuts reset attention constantly. Combined with your pace, the video never sits still.'
        : c <= 3
          ? 'Longer takes feel honest and unedited — people trust what isn\'t chopped up.'
          : 'A comfortable rhythm: enough movement to stay interesting, not so much it feels frantic.',
      why: 'Each cut is a small "wait, what\'s this" that pulls a wandering viewer back.',
      tip: quick
        ? 'Hold one shot a beat longer on the product close-up — it\'s the frame people screenshot.'
        : 'Add a single cut to a product close-up right after your hook.',
    });
  }

  if (profile.energy_level != null) {
    const e = profile.energy_level;
    out.push({
      key: 'energy', label: 'Energy', value: String(Math.round(e)), unit: '/100',
      you: e, typical: TYPICAL.energy, typicalLabel: `${TYPICAL.energy}`,
      headline: e >= 70 ? 'You bring big energy to camera.' : e >= 45 ? 'Your energy is warm and steady.' : 'You\'re calm on camera.',
      meaning: e >= 70
        ? 'Excitement is contagious — it\'s why hype-style pitches convert on live and short-form.'
        : e >= 45
          ? 'Even energy reads as sincere. People believe you\'re not performing.'
          : 'Low-key delivery stands out in a loud feed and suits considered, higher-ticket products.',
      why: 'Energy is the first thing a viewer feels, before they hear what you\'re selling.',
      tip: e >= 70
        ? 'Drop the energy for one sentence when you state the price or the "catch" — the contrast makes it land.'
        : 'Raise it one notch on the reveal moment only. Save the spike for what matters.',
    });
  }

  if (profile.authenticity_score != null) {
    const a = profile.authenticity_score;
    out.push({
      key: 'real', label: 'Realness', value: String(Math.round(a)), unit: '/100',
      you: a, typical: TYPICAL.authenticity, typicalLabel: `${TYPICAL.authenticity}`,
      headline: a >= 70 ? 'You come across as genuinely real.' : a >= 50 ? 'You read as real, with a little polish.' : 'You read as polished and produced.',
      meaning: a >= 70
        ? 'Filler words, self-corrections and natural phrasing — the stuff most people edit out is what makes you believable.'
        : a >= 50
          ? 'A mix of natural talk and rehearsed lines. Viewers can usually tell which is which.'
          : 'Tight delivery reads as an ad. That can work for brands, less so for creator-led selling.',
      why: 'On TikTok Shop, trust converts. Viewers buy from people who sound like they actually use the thing.',
      tip: a >= 70
        ? 'Every script we write keeps your fillers and tells on purpose. Don\'t "clean them up" when you record.'
        : 'Record the first take unscripted for 10 seconds, then read the script. Keep whichever sounds more like you.',
    });
  }

  if (style?.on_camera_pct != null) {
    const oc = Math.round(style.on_camera_pct <= 1 ? style.on_camera_pct * 100 : style.on_camera_pct);
    out.push({
      key: 'oncamera', label: 'On camera', value: String(oc), unit: '%',
      you: oc, typical: 60, typicalLabel: '60%',
      headline: oc >= 90 ? 'You\'re the face of every video.' : oc >= 50 ? 'You\'re on camera most of the time.' : 'You let the product or the visuals lead.',
      meaning: oc >= 90
        ? 'Viewers build a relationship with you, not just the product. That\'s what turns one sale into a repeat buyer.'
        : oc >= 50
          ? 'A healthy mix of you and b-roll — you\'re present without it feeling like a monologue.'
          : 'Voiceover and product shots carry the story. Efficient to make, but harder to build a following on.',
      why: 'A face on screen is the fastest trust signal there is — and the reason people follow instead of just buy.',
      tip: oc >= 90
        ? 'Try one video where the product gets the first 2 seconds and you enter on the hook line.'
        : 'Show your face in the first 3 seconds, even if the rest is voiceover.',
    });
  }

  if (style?.avg_viral_potential != null) {
    const v = Math.round(style.avg_viral_potential);
    out.push({
      key: 'viral', label: 'Shareability', value: String(v), unit: '/100',
      you: v, typical: TYPICAL.viral, typicalLabel: `${TYPICAL.viral}`,
      headline: v >= 70 ? 'Your style is built to be shared.' : v >= 50 ? 'Your videos have solid share potential.' : 'Your videos convert more than they travel.',
      meaning: v >= 70
        ? 'Pattern breaks, humor or surprise show up often — the ingredients people send to friends.'
        : v >= 50
          ? 'Some videos have a shareable moment; making it consistent is the unlock.'
          : 'Direct pitches sell but rarely get sent around. That\'s fine — as long as reach comes from somewhere.',
      why: 'Shares are the cheapest reach on the platform: every one is a free view from a trusted source.',
      tip: 'Put one "you have to see this" moment — a reaction, a reveal, a surprising fact — in the first half.',
    });
  }

  return out;
}

// ─── Archetype ───────────────────────────────────────────────────────────────

export interface Archetype { name: string; blurb: string }

export function archetype(
  profile: CreatorProfile,
  speech: SpeechTemplate | null,
  pacing: PacingTemplate | null,
  style: VideoStyleProfile | null,
): Archetype {
  const pace = speech?.pace_band;
  const fast = pace === 'rapid' || pace === 'fast' || (speech?.avg_wpm ?? 0) >= 175;
  const slow = pace === 'slow' || ((speech?.avg_wpm ?? 0) > 0 && (speech?.avg_wpm ?? 0) < 125);
  const energy = profile.energy_level ?? 50;
  const real = profile.authenticity_score ?? 50;
  const onCam = style?.on_camera_pct != null ? (style.on_camera_pct <= 1 ? style.on_camera_pct * 100 : style.on_camera_pct) : 100;
  const fmt = (style?.dominant_format ?? '').toLowerCase();
  const tone = (style?.dominant_content_tone ?? speech?.tone ?? '').toLowerCase();

  if (onCam < 40) return { name: 'The Voice Behind the Lens', blurb: 'You let the visuals lead and narrate the story — efficient, cinematic, product-first.' };
  if (fmt.includes('skit') || tone.includes('entertain') && energy >= 65)
    return { name: 'The Entertainer', blurb: 'You sell by making people laugh first. The product rides in on the bit.' };
  if (fast && energy >= 65) return { name: 'The Rapid-Fire Pitcher', blurb: 'Fast, confident, straight to camera. You create urgency without ever saying "hurry".' };
  if (slow && real >= 60) return { name: 'The Calm Explainer', blurb: 'You slow things down and make people understand. Trust is your whole strategy.' };
  if (real >= 70 && !fast) return { name: 'The Trusted Friend', blurb: 'You talk like someone recommending a product over coffee — and people buy because of it.' };
  if (energy >= 70) return { name: 'The Hype Host', blurb: 'Big energy, big reactions. Your excitement is the pitch.' };
  if (fast) return { name: 'The Quick Talker', blurb: 'You pack a lot into a little time and never lose the thread.' };
  return { name: 'The Natural', blurb: 'Easy on camera, easy to watch. Your style doesn\'t get in the way of the message.' };
}

// ─── Hooks, explained ────────────────────────────────────────────────────────

export const HOOK_EXPLAINERS: Record<string, { name: string; what: string; example: string }> = {
  pattern_interrupt: { name: 'Pattern interrupt', what: 'Something unexpected in the first frame — a movement, a sound, a visual trick — that breaks the scroll.', example: '“Wait — don\'t buy this yet.”' },
  curiosity_gap: { name: 'Curiosity gap', what: 'You hint at an answer without giving it, so people stay to close the loop.', example: '“Nobody tells you this about sea moss…”' },
  pain_point: { name: 'Pain point', what: 'You name the exact problem your viewer has before offering the fix.', example: '“If your hair is shedding like crazy…”' },
  question_hook: { name: 'Question', what: 'You open by asking the viewer something they immediately answer in their head.', example: '“What are you looking for?”' },
  bold_claim: { name: 'Bold claim', what: 'A confident statement that dares people to disagree.', example: '“This is the only supplement I\'d ever restock.”' },
  story: { name: 'Story', what: 'You drop the viewer into the middle of a moment and make them want the rest.', example: '“So my sister called me crying last night…”' },
  result_first: { name: 'Result first', what: 'You show the outcome before the process.', example: '“Three weeks. Look at the difference.”' },
  direct_address: { name: 'Direct address', what: 'You speak to one specific kind of person, so they feel called out.', example: '“For those of you over 40…”' },
  social_proof: { name: 'Social proof', what: 'You lead with how many people already love it.', example: '“Sold out three times — here\'s why.”' },
};

export function explainHook(slug: string) {
  const key = slug.toLowerCase().replace(/[\s-]+/g, '_');
  return HOOK_EXPLAINERS[key] ?? {
    name: key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    what: 'One of the ways you pull people into a video in the first seconds.',
    example: '',
  };
}

// ─── Playbook ────────────────────────────────────────────────────────────────

export interface Play { kind: 'more' | 'watch' | 'try'; title: string; body: string }

export function playbook(
  profile: CreatorProfile,
  speech: SpeechTemplate | null,
  pacing: PacingTemplate | null,
  style: VideoStyleProfile | null,
): Play[] {
  const more: Play[] = [];
  const watch: Play[] = [];
  const tries: Play[] = [];

  const wpm = speech?.avg_wpm ?? 0;
  const hook = pacing?.avg_hook_duration_sec ?? 0;
  const len = pacing?.avg_video_length_sec ?? 0;
  const cuts = pacing?.cuts_per_30s ?? 0;
  const energy = profile.energy_level ?? 0;
  const real = profile.authenticity_score ?? 0;
  const cta = (pacing?.typical_cta_position ?? '').toLowerCase();
  const phrases = speech?.signature_phrases ?? [];
  const formats = style?.format_distribution;
  const topFormat = Array.isArray(formats) && formats.length ? (formats as any[])[0] : null;

  // Do more of
  if (hook > 0 && hook <= 3) more.push({ kind: 'more', title: 'Keep opening on the hook line', body: `You reach the point in ${sec(hook)}. Most creators never fix this — you already have.` });
  if (real >= 65) more.push({ kind: 'more', title: 'Keep the rough edges', body: 'Your realness score is what makes people believe you use the product. Don\'t over-edit it out.' });
  if (phrases.length) more.push({ kind: 'more', title: `Keep saying “${phrases[0]}”`, body: 'Repeated lines become a brand. Regulars will start quoting you.' });
  if (energy >= 65 && wpm >= 175) more.push({ kind: 'more', title: 'Own the live-selling energy', body: 'Fast and high-energy is exactly the delivery that converts on lives and flash deals.' });

  // Watch out for
  if (wpm >= 200) watch.push({ kind: 'watch', title: 'Benefits can blur at this speed', body: 'At ~' + wpm + ' wpm, viewers catch the vibe but not the specifics. Slow down for the one line you want repeated.' });
  if (len > 0 && len <= 15 && cta.includes('end')) watch.push({ kind: 'watch', title: 'Your ask lands very late for a short video', body: `In a ${sec(len)} video, an end-only CTA gives viewers who leave early no reason to buy. Seed it once mid-way.` });
  if (cuts >= 8 && wpm >= 175) watch.push({ kind: 'watch', title: 'Fast talk + fast cuts can tip into frantic', body: 'Both are strengths. Together, hold one product shot a beat longer so the eye can rest.' });
  if (energy < 40) watch.push({ kind: 'watch', title: 'Flat energy on the reveal', body: 'Calm works — but the moment you show the result should visibly move you.' });
  if (real < 50) watch.push({ kind: 'watch', title: 'Sounding scripted', body: 'Polished delivery reads as an ad. Keep one unplanned sentence in every video.' });
  if (hook > 4) watch.push({ kind: 'watch', title: 'A slow start', body: `${sec(hook)} before the point is long. Start on your second sentence.` });

  // Try next
  if (style?.on_camera_pct != null && (style.on_camera_pct <= 1 ? style.on_camera_pct * 100 : style.on_camera_pct) >= 90)
    tries.push({ kind: 'try', title: 'Let the product open one video', body: 'Give the product the first 2 seconds, then enter on your hook line. It tests whether the product alone can stop the scroll.' });
  if (len > 0 && len <= 18) tries.push({ kind: 'try', title: 'Add one proof moment', body: 'A before/after, a result, a review on screen. You have the room — your videos are short.' });
  if (topFormat?.format && String(topFormat.format).includes('talking_head') && (topFormat.pct ?? 0) >= 75)
    tries.push({ kind: 'try', title: 'Break format once a week', body: 'Talking head is your default. A skit, a POV or a reaction video reaches people your pitches don\'t.' });
  if (!cta.includes('end') && cta) tries.push({ kind: 'try', title: 'Try an end-card ask', body: 'Your CTA lands in the ' + cta + '. Add a second, softer one at the very end for people who watched the whole thing.' });
  tries.push({ kind: 'try', title: 'Write your next script here', body: 'ScriptIQ writes in this exact voice — pace, phrases, fillers and all. Test it on a product you already love.' });

  return [...more.slice(0, 2), ...watch.slice(0, 2), ...tries.slice(0, 2)];
}

// ─── Small formatters used by the page ───────────────────────────────────────

export function distList(v: unknown, keyName: string): { label: string; pct: number }[] {
  // Accepts either [{format, pct}] / [{style, count}] arrays or {key: n} maps.
  if (!v) return [];
  const rows: { label: string; n: number }[] = [];
  if (Array.isArray(v)) {
    for (const r of v as any[]) {
      const label = String(r?.[keyName] ?? r?.name ?? r?.label ?? '');
      const n = Number(r?.pct ?? r?.count ?? r?.value ?? 0);
      if (label) rows.push({ label, n });
    }
  } else if (typeof v === 'object') {
    for (const [k, n] of Object.entries(v as Record<string, number>)) rows.push({ label: k, n: Number(n) || 0 });
  }
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  const usePct = Array.isArray(v) && (v as any[]).some((r) => r?.pct != null);
  return rows
    .map((r) => ({ label: r.label, pct: Math.round(usePct ? r.n : (r.n / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}
