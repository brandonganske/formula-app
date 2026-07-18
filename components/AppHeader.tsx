import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { D, T, Shadow, Gradient } from '@/constants/ds';
import Svg, { Rect, Circle } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { Zap } from 'lucide-react-native';

function ProfileAvatarIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={10} r={5.4} fill="#fff" />
      <Rect x={6.5} y={20} width={19} height={8.5} rx={4.25} fill="#fff" />
      <Rect x={6.5} y={20} width={9.5} height={8.5} rx={4.25} fill="#B6FF8A" />
    </Svg>
  );
}

export default function AppHeader() {
  const router = useRouter();
  const { credits, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const lowCredits = credits <= 3;

  return (
    <View style={[S.root, { paddingTop: insets.top + 12 }]}>
      {/* Left — wordmark */}
      <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7} hitSlop={12}>
        <View style={S.wordmarkRow}>
          <Text style={S.wordmark}>formula</Text>
          <Text style={S.wordmarkDot}>.</Text>
        </View>
      </TouchableOpacity>

      {/* Right — credits + profile */}
      <View style={S.rightRow}>
        {isAuthenticated && (
          <TouchableOpacity
            style={[S.creditsPill, lowCredits && S.creditsPillLow]}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            hitSlop={8}
          >
            <Zap
              size={12}
              color={lowCredits ? D.coral : D.limeDeep}
              strokeWidth={2.5}
              fill={lowCredits ? D.coral : D.limeDeep}
            />
            <Text style={[S.creditsText, lowCredits && S.creditsTextLow]}>
              {credits}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={S.profileBtnOuter}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <LinearGradient
            colors={Gradient.hero}
            start={{ x: 0.13, y: 0 }}
            end={{ x: 0.87, y: 1 }}
            style={S.profileBtn}
          >
            <ProfileAvatarIcon />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: 'rgba(244,243,239,0.96)',
    borderBottomWidth: 0.5,
    borderBottomColor: D.inkHairline,
  },

  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-end' },
  wordmark: {
    ...T.bold, fontSize: 22, color: D.ink,
    letterSpacing: -0.9, lineHeight: 26,
  },
  wordmarkDot: {
    ...T.bold, fontSize: 22, color: D.coral,
    letterSpacing: -0.9, lineHeight: 26,
  },

  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(47,161,12,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(47,161,12,0.22)',
  },
  creditsPillLow: {
    backgroundColor: D.coralSubtle,
    borderColor: D.coral + '30',
  },
  creditsText: {
    ...T.bold,
    fontSize: 13,
    color: D.limeDeep,
    letterSpacing: -0.2,
  },
  creditsTextLow: {
    color: D.coral,
  },

  profileBtnOuter: {
    borderRadius: 21,
    ...Shadow.soft,
  },
  profileBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
});
