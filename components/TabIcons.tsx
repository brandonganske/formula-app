import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { Settings as SettingsGlyph } from 'lucide-react-native';

// The bottom-bar glyphs, shared so the app tour (and anything else that
// points at a tab) draws exactly what the creator sees in the bar.

export function IconSaved({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3.5 7.5a2 2 0 0 1 2-2h4.2l2 2.2h6.8a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10.5Z" />
    </Svg>
  );
}

export function IconProducts({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 9.5 5.2 5.4A1.6 1.6 0 0 1 6.74 4.3h10.52a1.6 1.6 0 0 1 1.54 1.1L20 9.5" />
      <Path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <Path d="M5.5 12v6.4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V12" />
      <Path d="M10 19.4v-3.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3.6" />
    </Svg>
  );
}

export function IconTools({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3.5} y={3.5} width={7} height={7} rx={2} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={2} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={2} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={2} />
    </Svg>
  );
}

export function IconSettings({ color, size = 24 }: { color: string; size?: number }) {
  return <SettingsGlyph size={size} color={color} strokeWidth={1.9} />;
}

// The red-button glyph: three script lines + the lime cursor.
export function ScriptIQIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x={6}  y={8}  width={20} height={3.4} rx={1.7} fill="#fff" />
      <Rect x={6}  y={15} width={14} height={3.4} rx={1.7} fill="#fff" />
      <Rect x={6}  y={22} width={9}  height={3.4} rx={1.7} fill="#fff" />
      <Rect x={23} y={20} width={3.4} height={7.6} rx={1.7} fill="#B6FF8A" />
    </Svg>
  );
}
