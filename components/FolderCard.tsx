import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Folder, Trash2 } from 'lucide-react-native';
import { D, T, R, Shadow } from '@/constants/ds';

// One folder tile — used by both saved scripts and saved products so the two
// shelves in Saved look identical.
export default function FolderCard({
  name, color, countLabel, onPress, onDelete, isDropTarget,
}: {
  name: string;
  color: string;
  countLabel: string;
  onPress: () => void;
  onDelete?: () => void;
  isDropTarget?: boolean;
}) {
  return (
    <TouchableOpacity style={[FC.card, isDropTarget && FC.cardDropTarget]} onPress={onPress} activeOpacity={0.85}>
      <View style={FC.top}>
        <LinearGradient colors={[color + 'E6', color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={FC.iconBox}>
          <Folder size={19} color="#FFF" strokeWidth={2} />
        </LinearGradient>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.6} style={FC.trashBtn}>
            <Trash2 size={13} color={D.textDisabled} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={FC.name} numberOfLines={2}>{name}</Text>
      <View style={[FC.countPill, { backgroundColor: color + '14' }]}>
        <Text style={[FC.count, { color }]}>{countLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export const FOLDER_GRID = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  cell: { width: '48%' },
});

const FC = StyleSheet.create({
  card: {
    width: '100%', backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 14,
    gap: 12, ...Shadow.soft,
  },
  cardDropTarget: { backgroundColor: D.coralSubtle, borderColor: D.coral, borderWidth: 2, transform: [{ scale: 1.04 }], ...Shadow.coral },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  trashBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: D.surface },
  name: { ...T.bold, fontSize: 15, color: D.textPrimary, lineHeight: 20, minHeight: 40 },
  countPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  count: { ...T.bold, fontSize: 11 },
});
