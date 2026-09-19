import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import { D, T, R } from '@/constants/ds';
import { ShieldCheck, Lightbulb } from 'lucide-react-native';
import type { ShopSafeResult, ShopSafeFinding } from '@/types/api';

export const GRADE_COLOR: Record<string, string> = { A: '#2FA10C', B: '#7BC043', C: '#F5A623', D: '#F5702B', F: D.coral };
const SEV: Record<string, { bg: string; fg: string }> = {
  critical: { bg: D.coral, fg: '#FFF' }, high: { bg: '#F5702B', fg: '#FFF' }, medium: { bg: '#FFE7B3', fg: '#7A4B00' }, low: { bg: D.inkHairline, fg: D.textMuted },
};
const fmtTime = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

export function GradePill({ grade, score, size = 'sm' }: { grade: string; score?: number | null; size?: 'sm' | 'lg' }) {
  const big = size === 'lg';
  return (
    <View style={[S.pill, { backgroundColor: GRADE_COLOR[grade] ?? D.textDisabled }, big && S.pillLg]}>
      <ShieldCheck size={big ? 16 : 11} color="#FFF" strokeWidth={2.6} />
      <Text style={[S.pillText, big && S.pillTextLg]}>{grade}{score != null && big ? `  ·  ${score}` : ''}</Text>
    </View>
  );
}

// The report body — shared by the saved-script sheet and the video screen.
export default function ShopSafeReport({ r, onUseFix }: { r: ShopSafeResult; onUseFix?: (f: ShopSafeFinding) => void }) {
  return (
    <View>
      <View style={S.head}>
        <View style={[S.gradeBox, { backgroundColor: GRADE_COLOR[r.grade] ?? D.textDisabled }]}>
          <Text style={S.gradeText}>{r.grade}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.scoreLine}>{r.score}<Text style={S.scoreOf}> / 100 · {r.findings.length} {r.findings.length === 1 ? 'thing' : 'things'} to fix</Text></Text>
          <Text style={S.summary}>{r.summary}</Text>
        </View>
      </View>

      {r.findings.length === 0 ? (
        <View style={S.clear}>
          <ShieldCheck size={18} color={D.limeDeep} strokeWidth={2.4} />
          <Text style={S.clearText}>Nothing trips the rubric. You're good to post.</Text>
        </View>
      ) : r.findings.map((f, i) => (
        <View key={i} style={S.finding}>
          <View style={S.fRow}>
            <View style={[S.sev, { backgroundColor: SEV[f.severity]?.bg }]}><Text style={[S.sevText, { color: SEV[f.severity]?.fg }]}>{f.severity}</Text></View>
            <Text style={S.fMeta}>{f.channel.replace('_', ' ')}{f.timestamp_sec != null ? ` · ${fmtTime(f.timestamp_sec)}` : ''}</Text>
          </View>
          <Text style={S.quote}>“{f.quote}”</Text>
          <Text style={S.why}>{f.why}</Text>
          <View style={S.fix}>
            <View style={S.fixIcon}><Lightbulb size={13} color={D.limeDeep} strokeWidth={2.4} /></View>
            <View style={{ flex: 1 }}>
              <Text style={S.fixLabel}>Say instead</Text>
              <Text style={S.fixText}>{f.fix}</Text>
              {onUseFix && (
                <AnimatedPressable style={S.useBtn} haptic="light" onPress={() => onUseFix(f)}>
                  <Text style={S.useText}>Use this fix</Text>
                </AnimatedPressable>
              )}
            </View>
          </View>
        </View>
      ))}
      <Text style={S.foot}>Shop Safe flags what TikTok tends to flag or de-rank. It's a risk check, not a guarantee.</Text>
    </View>
  );
}

const S = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  pillLg: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  pillText: { ...T.bold, fontSize: 11, color: '#FFF' },
  pillTextLg: { fontSize: 14 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 16 },
  gradeBox: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  gradeText: { ...T.bold, fontSize: 30, color: '#FFF', letterSpacing: -1 },
  scoreLine: { ...T.bold, fontSize: 20, color: D.textPrimary, letterSpacing: -0.4 },
  scoreOf: { ...T.medium, fontSize: 13, color: D.textMuted, letterSpacing: 0 },
  summary: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, marginTop: 4 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: D.limeSubtle, borderRadius: 16, padding: 14 },
  clearText: { ...T.bold, fontSize: 14.5, color: D.limeDeep, flex: 1 },
  finding: { backgroundColor: D.surface, borderRadius: 18, borderWidth: 1, borderColor: D.border, padding: 14, marginBottom: 10 },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sev: { borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  sevText: { ...T.bold, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  fMeta: { ...T.medium, fontSize: 12, color: D.textMuted },
  quote: { ...T.medium, fontSize: 15, color: D.textPrimary, lineHeight: 21, fontStyle: 'italic', borderLeftWidth: 2, borderLeftColor: D.coral, paddingLeft: 10 },
  why: { ...T.regular, fontSize: 13.5, color: D.textMuted, lineHeight: 19, marginTop: 8 },
  fix: { flexDirection: 'row', gap: 10, backgroundColor: D.limeSubtle, borderRadius: 14, padding: 12, marginTop: 10 },
  fixIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  fixLabel: { ...T.bold, fontSize: 10.5, color: D.limeDeep, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  fixText: { ...T.bold, fontSize: 14, color: D.ink, lineHeight: 20 },
  useBtn: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: D.ink, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7 },
  useText: { ...T.bold, fontSize: 12.5, color: '#FFF' },
  foot: { ...T.regular, fontSize: 12, color: D.textDisabled, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
