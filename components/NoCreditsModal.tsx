import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Zap, X, ShoppingBag } from 'lucide-react-native';
import FadeInView from '@/components/FadeInView';
import { D, T, R, Shadow } from '@/constants/ds';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NoCreditsModal({ visible, onClose }: Props) {
  const router = useRouter();

  const handleBuy = () => {
    onClose();
    router.push('/(tabs)/profile');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <FadeInView direction="none" duration={200} style={S.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <FadeInView direction="up" style={S.sheet}>
          {/* Close */}
          <TouchableOpacity style={S.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={18} color={D.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={S.iconWrap}>
            <LinearGradient
              colors={['#FF7A45', '#FF3755']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={S.iconGrad}
            >
              <Zap size={26} color="#FFF" strokeWidth={2} fill="#FFF" />
            </LinearGradient>
          </View>

          <Text style={S.title}>Out of Credits</Text>
          <Text style={S.sub}>
            You've used all your AI credits. Top up to keep generating scripts
            and pulling product intelligence.
          </Text>

          {/* Stats row */}
          <View style={S.statsRow}>
            <View style={S.statBox}>
              <Text style={S.statNum}>0</Text>
              <Text style={S.statLabel}>Credits left</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statBox}>
              <Text style={[S.statNum, { color: D.limeDeep }]}>1</Text>
              <Text style={S.statLabel}>Per generation</Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity style={S.buyBtn} onPress={handleBuy} activeOpacity={0.88}>
            <ShoppingBag size={16} color="#FFF" strokeWidth={2} />
            <Text style={S.buyBtnText}>Get More Credits</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.dismissBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={S.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </FadeInView>
      </FadeInView>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,20,38,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: D.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
    ...Shadow.card,
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: D.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginBottom: 18,
    marginTop: 8,
    ...Shadow.coral,
    borderRadius: 22,
  },
  iconGrad: {
    width: 68, height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...T.bold,
    fontSize: 24,
    color: D.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  sub: {
    ...T.regular,
    fontSize: 14,
    color: D.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: D.surface,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: D.border,
    marginBottom: 24,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: D.border,
    marginVertical: 12,
  },
  statNum: {
    ...T.bold,
    fontSize: 28,
    color: D.coral,
    letterSpacing: -0.6,
  },
  statLabel: {
    ...T.medium,
    fontSize: 12,
    color: D.textMuted,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: D.coral,
    borderRadius: R.full,
    paddingVertical: 15,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadow.coral,
  },
  buyBtnText: {
    ...T.bold,
    fontSize: 16,
    color: '#FFF',
    letterSpacing: -0.2,
  },
  dismissBtn: {
    paddingVertical: 10,
  },
  dismissText: {
    ...T.medium,
    fontSize: 14,
    color: D.textMuted,
  },
});
