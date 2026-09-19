import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { D, T, Shadow } from '@/constants/ds';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import AnimatedPressable from '@/components/AnimatedPressable';
import ClipboardCatch from '@/components/ClipboardCatch';
import ScriptsToast from '@/components/ScriptsToast';
import { useAuth } from '@/context/AuthContext';
import { IconSaved, IconProducts, IconTools, IconSettings, ScriptIQIcon } from '@/components/TabIcons';
import { haptic } from '@/lib/haptics';

const INACTIVE = 'rgba(26,20,38,0.34)';

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconProfile({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={10} r={5} stroke={color} strokeWidth={2.4} />
      <Rect x={6.8} y={20} width={18.4} height={8} rx={4} stroke={color} strokeWidth={2.4} />
    </Svg>
  );
}

// Profile tab: the creator's real TikTok avatar (coral ring when active),
// falling back to the generic icon when there's no picture yet.
function IconProfileAvatar({ color }: { color: string }) {
  const { profile } = useAuth();
  const uri = profile?.avatar_url;
  if (!uri) return <IconProfile color={color} />;
  const active = color === D.coral;
  return (
    <View style={[S.avatarWrap, active ? S.avatarWrapActive : S.avatarWrapIdle]}>
      <Image source={{ uri }} style={S.avatarImg} />
    </View>
  );
}

// ─── Tab item ─────────────────────────────────────────────────────────────────

type IconComp = (p: { color: string }) => React.ReactElement;

function TabItem({ Icon, label, focused }: { Icon: IconComp; label: string; focused: boolean }) {
  const color = focused ? D.coral : INACTIVE;
  return (
    <View style={S.tabItem}>
      <View style={S.tabIco}><Icon color={color} /></View>
      <Text style={[S.tabLabel, focused && S.tabLabelFocused, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────

// Order: Tools | Products | [FAB ScriptIQ] | Saved | Settings
// `index` is the creator profile — reached only from the top-bar avatar, not
// a tab. `profile` is settings.
const VISIBLE = ['tools', 'products', 'scriptiq', 'scripts', 'profile'];

const TAB_MAP: Record<string, { Icon: IconComp; label: string }> = {
  tools:    { Icon: IconTools,    label: 'Tools' },
  products: { Icon: IconProducts, label: 'Products' },
  scripts:  { Icon: IconSaved,    label: 'Saved' },
  profile:  { Icon: IconSettings, label: 'Settings' },
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const routes = VISIBLE
    .map((name: string) => state.routes.find((r: any) => r.name === name))
    .filter(Boolean);

  return (
    <View style={[S.bar, { paddingBottom: Math.max(insets.bottom, 9) + (Platform.OS === 'ios' ? 4 : 0) }]}>
      {routes.map((route: any) => {
        const focused = state.routes[state.index]?.name === route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (route.name === 'scriptiq') {
          return (
            <View key={route.key} style={S.fabSlot}>
              <AnimatedPressable style={S.fab} onPress={onPress} haptic="light">
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.55 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <ScriptIQIcon />
                <Text style={S.fabLabel}>Scripting</Text>
              </AnimatedPressable>
            </View>
          );
        }

        const cfg = TAB_MAP[route.name];
        if (!cfg) return null;

        return (
          <TouchableOpacity key={route.key} style={S.tab} onPress={() => { if (!focused) haptic.select(); onPress(); }} activeOpacity={0.7}>
            <TabItem Icon={cfg.Icon} label={cfg.label} focused={focused} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <>
      <Tabs
        initialRouteName="tools"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: true, header: () => <AppHeader /> }}
      >
        <Tabs.Screen name="tools"    options={{ title: 'Tools' }} />
        <Tabs.Screen name="index"    options={{ title: 'Profile' }} />
        <Tabs.Screen name="scripts"  options={{ title: 'Saved' }} />
        <Tabs.Screen name="scriptiq" options={{ title: 'ScriptIQ' }} />
        <Tabs.Screen name="products" options={{ title: 'Products' }} />
        <Tabs.Screen name="profile"  options={{ title: 'Settings' }} />
        <Tabs.Screen name="shop"          options={{ href: null }} />
        <Tabs.Screen name="rewrite"       options={{ href: null }} />
        <Tabs.Screen name="videos"        options={{ href: null }} />
        <Tabs.Screen name="productscript" options={{ href: null }} />
        <Tabs.Screen name="organicscript" options={{ href: null }} />
        <Tabs.Screen name="viraltopic"    options={{ href: null }} />
      </Tabs>
      <ClipboardCatch />
      <ScriptsToast />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(244,243,239,0.96)',
    borderTopWidth: 0.5,
    borderTopColor: D.inkLine,
    paddingHorizontal: 12,
    paddingTop: 9,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
  },
  tabIco: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 26, height: 26, borderRadius: 13, overflow: 'hidden',
    borderWidth: 2, backgroundColor: D.surface,
  },
  avatarWrapActive: { borderColor: D.coral },
  avatarWrapIdle: { borderColor: 'transparent' },
  avatarImg: { width: '100%', height: '100%' },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.05,
    lineHeight: 14,
    ...T.medium,
  },
  tabLabelFocused: {
    ...T.bold,
  },
  fabSlot: {
    width: 72,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: { ...T.bold, fontSize: 9, color: '#FFF', letterSpacing: 0.2, marginTop: -2 },
  fab: {
    width: 64,
    height: 60,
    borderRadius: 20,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadow.coral,
  },
});
