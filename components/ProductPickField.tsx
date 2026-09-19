import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import AnimatedPressable from '@/components/AnimatedPressable';
import { api, extractData } from '@/lib/api';
import { fromSaved } from '@/lib/product-handoff';
import { D, T, R } from '@/constants/ds';
import type { SavedProductItem } from '@/types/api';

// A product name field with the creator's saved products as one-tap chips.
export default function ProductPickField({ value, onChange, placeholder = 'Product name…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { data } = useQuery({
    queryKey: ['saved-products-lite'],
    queryFn: async () => extractData<{ products?: SavedProductItem[] }>(await api.get('/creators/saved-products'))?.products ?? [],
    staleTime: 60_000,
  });
  const saved = (data ?? []).map(fromSaved);
  return (
    <View>
      <View style={S.box}>
        <TextInput style={S.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={D.textDisabled} autoCapitalize="words" />
      </View>
      {saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips} style={{ marginTop: 10 }}>
          {saved.slice(0, 12).map((p) => {
            const on = value === p.title;
            return (
              <AnimatedPressable key={p.external_id} style={[S.chip, on && S.chipOn]} haptic="light" onPress={() => onChange(on ? '' : p.title)}>
                <Text style={[S.chipText, on && S.chipTextOn]} numberOfLines={1}>{p.title}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  box: { backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 18, height: 52, justifyContent: 'center' },
  input: { ...T.medium, fontSize: 15, color: D.textPrimary },
  chips: { gap: 8, paddingRight: 4 },
  chip: { maxWidth: 200, borderRadius: R.full, borderWidth: 1, borderColor: D.border, backgroundColor: D.card, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  chipText: { ...T.medium, fontSize: 13, color: D.textSecondary },
  chipTextOn: { ...T.bold, color: D.coral },
});
