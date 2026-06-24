import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { D, T } from '@/constants/ds';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/AuthContext';

const INACTIVE = 'rgba(26,20,38,0.34)';

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconSaved({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 4.8h10a1 1 0 0 1 1 1V19.4a.6.6 0 0 1-.95.49L12 16.3l-5.05 3.59A.6.6 0 0 1 6 19.4V5.8a1 1 0 0 1 1-1Z" />
      <Path d="M9 9h6" />
      <Path d="M9 12h3.5" />
    </Svg>
  );
}

function IconProducts({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 9.5 5.2 5.4A1.6 1.6 0 0 1 6.74 4.3h10.52a1.6 1.6 0 0 1 1.54 1.1L20 9.5" />
      <Path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <Path d="M5.5 12v6.4a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V12" />
      <Path d="M10 19.4v-3.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3.6" />
    </Svg>
  );
}

function IconProfile({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={10} r={5} stroke={color} strokeWidth={2.4} />
      <Rect x={6.8} y={20} width={18.4} height={8} rx={4} stroke={color} strokeWidth={2.4} />
    </Svg>
  );
}

function IconBrain({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 32 32" fill="none">
      <Path
        d="M15 7.2c-1.3-1.6-4-1.7-5.2-.1-2 .1-3.3 2-2.6 3.7-1.6.8-1.8 3.1-.2 4.2-.5 1.8 1 3.6 2.9 3.4.5 1.5 2.3 2.3 3.7 1.5M15 7.2c1.1-1.4 3.3-1.6 4.7-.5"
        stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      />
      <Rect x={10.6} y={11.4} width={7.4} height={2.4} rx={1.2} fill={color} />
      <Rect x={10.6} y={15.2} width={4.8} height={2.4} rx={1.2} fill={color} />
      <Rect x={20} y={14} width={2.6} height={7.2} rx={1.3} fill={color} />
    </Svg>
  );
}

function ScriptIQIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 32 32" fill="none">
      <Rect x={6}  y={8}  width={20} height={3.4} rx={1.7} fill="#fff" />
      <Rect x={6}  y={15} width={14} height={3.4} rx={1.7} fill="#fff" />
      <Rect x={6}  y={22} width={9}  height={3.4} rx={1.7} fill="#fff" />
      <Rect x={23} y={20} width={3.4} height={7.6} rx={1.7} fill="#B6FF8A" />
    </Svg>
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

// Order: Products | Saved | [FAB ScriptIQ] | Brain | Profile
const VISIBLE = ['products', 'scripts', 'scriptiq', 'index', 'profile'];

const TAB_MAP: Record<string, { Icon: IconComp; label: string }> = {
  products: { Icon: IconProducts, label: 'Products' },
  scripts:  { Icon: IconSaved,    label: 'Saved' },
  index:    { Icon: IconBrain,    label: 'Brain' },
  profile:  { Icon: IconProfile,  label: 'Profile' },
};

function CustomTabBar({ state, navigation }: any) {
  const routes = VISIBLE
    .map((name: string) => state.routes.find((r: any) => r.name === name))
    .filter(Boolean);

  return (
    <View style={S.bar}>
      {routes.map((route: any) => {
        const focused = state.routes[state.index]?.name === route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (route.name === 'scriptiq') {
          return (
            <View key={route.key} style={S.fabSlot}>
              <TouchableOpacity style={S.fab} onPress={onPress} activeOpacity={0.88}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.55 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <ScriptIQIcon />
              </TouchableOpacity>
            </View>
          );
        }

        const cfg = TAB_MAP[route.name];
        if (!cfg) return null;

        return (
          <TouchableOpacity key={route.key} style={S.tab} onPress={onPress} activeOpacity={0.7}>
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
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: true, header: () => <AppHeader /> }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Brain' }} />
      <Tabs.Screen name="scripts"  options={{ title: 'Saved' }} />
      <Tabs.Screen name="scriptiq" options={{ title: 'ScriptIQ' }} />
      <Tabs.Screen name="products" options={{ title: 'Products' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile' }} />
      <Tabs.Screen name="rewrite"       options={{ href: null }} />
      <Tabs.Screen name="videos"        options={{ href: null }} />
      <Tabs.Screen name="productscript" options={{ href: null }} />
      <Tabs.Screen name="organicscript" options={{ href: null }} />
      <Tabs.Screen name="viraltopic"    options={{ href: null }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SAFE_BOTTOM = Platform.OS === 'ios' ? 22 : 9;

const S = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(26,20,38,0.12)',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: SAFE_BOTTOM,
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
  fab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(26,20,38,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 4,
  },
});
