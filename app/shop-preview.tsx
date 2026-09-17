import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { D } from '@/constants/ds';
import ShopDashboardView, { SAMPLE_SHOP_DASHBOARD } from '@/components/ShopDashboardView';

// ─── DESIGN-PREVIEW ROUTE ────────────────────────────────────────────────────
// Top-level route (outside the (tabs) group) so it has NO auth guard, letting
// the "Your Shop" connected dashboard be previewed on web without logging in at
// http://localhost:8081/shop-preview. Renders the shared ShopDashboardView with
// realistic sample data; the generate/disconnect handlers are no-ops here.

export default function ShopPreviewScreen() {
  return (
    <SafeAreaView style={S.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <ShopDashboardView
          data={SAMPLE_SHOP_DASHBOARD}
          onGenerate={(productId) => console.log('[preview] generate scripts', productId)}
          onDisconnect={() => console.log('[preview] disconnect')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.paper },
  scroll: { paddingBottom: 40 },
});
