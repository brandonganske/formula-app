import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Platform, Animated, KeyboardAvoidingView,
  Alert, Modal,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import { Skeleton } from '@/components/Skeleton';
import SavedProductsView from '@/components/products/SavedProductsView';
import SavedVideosView from '@/components/SavedVideosView';
import OutcomeSheet from '@/components/OutcomeSheet';
import ShopSafeSheet from '@/components/ShopSafeSheet';
import { GradePill } from '@/components/ShopSafeReport';
import FolderCard from '@/components/FolderCard';
import { SavedProductItem, ShopDashboard } from '@/types/api';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { storage } from '@/lib/storage';
import { SavedScriptItem, SavedScriptsResponse } from '@/types/api';
import { useAuth } from '@/context/AuthContext';
import { D, T, R, Shadow, Ease, Gradient, SectionLabelStyle, FOLDER_COLORS } from '@/constants/ds';
import {
  FolderPlus, Folder, FolderOpen, Copy, Check, RefreshCw,
  ChevronRight, ChevronLeft, Plus, X, Trash2, Zap,
  ShoppingBag, Film, Sparkles, BookOpen, AlertTriangle, Pencil, TrendingUp,
} from 'lucide-react-native';

const fmtCompact = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
};

// ── Types ──────────────────────────────────────────────────────────────────

// UI-facing folder shape (composed from the folders + items API response).
interface FolderData {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  scriptIds: string[];
}

// Creator API rows — a folder list plus a junction list, so one script can
// live in many folders. Returned together from GET /creators/script-folders.
interface ScriptFolderRow {
  id: string;
  creator_id: string;
  name: string;
  color: string;
  created_at: string;
}
interface ScriptFolderItemRow {
  folder_id: string;
  script_id: string;
}

// ── Constants ──────────────────────────────────────────────────────────────


// ── Legacy local-storage keys (used only by the one-time migration) ────────

function storageKey(userId: string) {
  return `toolkit_folders_v1_${userId}`;
}
function migratedKey(userId: string) {
  return `toolkit_folders_migrated_v1_${userId}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function originLabel(origin: string | null | undefined): string {
  if (origin === 'product_script') return 'Shop';
  if (origin === 'organic_script') return 'Organic';
  if (origin === 'viral_topic') return 'Viral';
  return 'Rewrite';
}

function originColor(origin: string | null | undefined): string {
  if (origin === 'product_script') return D.coral;
  if (origin === 'organic_script') return D.limeDeep;
  if (origin === 'viral_topic') return D.amber;
  return D.cyan;
}

function OriginIcon({ origin, size = 10 }: { origin: string | null | undefined; size?: number }) {
  if (origin === 'product_script') return <ShoppingBag size={size} color={D.coral} strokeWidth={2} />;
  if (origin === 'organic_script') return <Sparkles size={size} color={D.limeDeep} strokeWidth={2} />;
  if (origin === 'viral_topic') return <TrendingUp size={size} color={D.amber} strokeWidth={2} />;
  return <Film size={size} color={D.cyan} strokeWidth={2} />;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

// ── Script card ────────────────────────────────────────────────────────────

function ScriptCard({
  item,
  index,
  folders,
  onAddToFolder,
  isDraggingThis,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  item: SavedScriptItem;
  index: number;
  folders: FolderData[];
  onAddToFolder: (item: SavedScriptItem) => void;
  isDraggingThis?: boolean;
  onDragStart: (item: SavedScriptItem, absX: number, absY: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [localName, setLocalName] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [showSafe, setShowSafe] = useState(false);
  const outcome = item.outcome ?? null;
  const recent = Date.now() - new Date(item.created_at).getTime() < 45 * 86_400_000;

  const startRename = () => {
    setNameInput(displayTitle);
    setRenaming(true);
  };

  const saveRename = async () => {
    const trimmed = nameInput.trim();
    const prev = localName ?? null;
    setRenaming(false);
    if (!trimmed || trimmed === displayTitle) return;
    setLocalName(trimmed); // optimistic
    try {
      await api.patch(`/creators/scripts/${item.id}`, { title: trimmed });
      queryClient.invalidateQueries({ queryKey: ['saved-scripts'] });
    } catch (err: any) {
      // Roll back the optimistic title and tell the user it didn't stick.
      setLocalName(prev);
      Alert.alert('Rename failed', err?.response?.data?.error?.message ?? err?.message ?? 'Could not rename this script. Please try again.');
    }
  };

  const folderCount = folders.filter((f) => f.scriptIds.includes(item.id)).length;
  const displayTitle = localName ?? item.option_label ?? item.product_name ?? 'Untitled script';
  const color = originColor(item.origin);

  // Long-press-then-drag, handled by gesture-handler so it doesn't race the
  // surrounding ScrollView. runOnJS(true) keeps the callbacks on the JS thread
  // (no reanimated worklets), so they can drive a core Animated ghost directly.
  const drag = useMemo(() => Gesture.Pan()
    .activateAfterLongPress(220)
    .maxPointers(1)
    .runOnJS(true)
    .onStart((e) => onDragStart(item, e.absoluteX, e.absoluteY))
    .onUpdate((e) => onDragMove(e.absoluteX, e.absoluteY))
    .onEnd(() => onDragEnd())
    .onFinalize(() => onDragCancel()),
  [item, onDragStart, onDragMove, onDragEnd, onDragCancel]);

  return (
    <GestureDetector gesture={drag}>
    <View collapsable={false}>
    <FadeInView delay={index * 40} style={[SC.card, isDraggingThis && SC.cardDragging]}>
      {/* Identity — origin mark, title, context. Tap → full script. */}
      <TouchableOpacity style={SC.top} onPress={() => { if (!renaming) router.push(`/script/${item.id}`); }} activeOpacity={0.8}>
        <View style={[SC.mark, { backgroundColor: color + '18' }]}>
          <OriginIcon origin={item.origin} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <View style={SC.renameRow}>
              <TextInput
                style={SC.renameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveRename}
                onBlur={saveRename}
                maxLength={80}
              />
              <TouchableOpacity onPress={saveRename} hitSlop={14}><Check size={15} color={D.success} strokeWidth={2.5} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setRenaming(false)} hitSlop={14}><X size={15} color={D.textMuted} strokeWidth={2} /></TouchableOpacity>
            </View>
          ) : (
            <Text style={SC.title} numberOfLines={1}>{displayTitle}</Text>
          )}
          <Text style={SC.context} numberOfLines={1}>
            {item.product_name ? item.product_name : originLabel(item.origin)}
            <Text style={SC.contextDim}>  ·  {relDate(item.created_at)}</Text>
          </Text>
        </View>
        {!renaming && <ChevronRight size={16} color={D.textDisabled} strokeWidth={2} />}
      </TouchableOpacity>

      {/* The hook — the one line that sells the script */}
      {item.hook ? <Text style={SC.hook} numberOfLines={2}>“{item.hook}”</Text> : null}

      {/* Status strip — Shop Safe + results on the left, actions on the right */}
      <View style={SC.strip}>
        <View style={SC.stripLeft}>
          <TouchableOpacity onPress={() => setShowSafe(true)} hitSlop={6} activeOpacity={0.8}>
            {item.shop_safe_grade
              ? <GradePill grade={item.shop_safe_grade} />
              : <View style={SC.chip}><Text style={SC.chipText}>Shop Safe</Text></View>}
          </TouchableOpacity>
          {outcome ? (
            <TouchableOpacity style={[SC.chip, SC.chipLime]} onPress={() => setShowOutcome(true)} activeOpacity={0.8} hitSlop={6}>
              <Text style={[SC.chipText, SC.chipLimeText]} numberOfLines={1}>
                {fmtCompact(outcome.views)} views{outcome.gmv != null ? ` · $${fmtCompact(outcome.gmv)}` : ''}
              </Text>
            </TouchableOpacity>
          ) : recent ? (
            <TouchableOpacity style={[SC.chip, SC.chipCoral]} onPress={() => setShowOutcome(true)} activeOpacity={0.8} hitSlop={6}>
              <Text style={[SC.chipText, SC.chipCoralText]}>Posted it?</Text>
            </TouchableOpacity>
          ) : null}
          {folderCount > 0 && (
            <View style={SC.chip}><Folder size={10} color={D.textMuted} strokeWidth={2.2} /><Text style={SC.chipText}>{folderCount}</Text></View>
          )}
        </View>
        {!renaming && (
          <View style={SC.stripRight}>
            <TouchableOpacity style={[SC.iconBtn, SC.iconBtnInk]} onPress={() => router.push({ pathname: '/teleprompter', params: { scriptId: item.id } })} hitSlop={6} activeOpacity={0.7}>
              <Film size={14} color="#FFF" strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity style={SC.iconBtn} onPress={startRename} hitSlop={6} activeOpacity={0.7}>
              <Pencil size={13} color={D.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={[SC.iconBtn, SC.iconBtnCoral]} onPress={() => onAddToFolder(item)} hitSlop={6} activeOpacity={0.7}>
              <FolderPlus size={14} color={D.coral} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {showOutcome && <OutcomeSheet scriptId={item.id} current={outcome} onClose={() => setShowOutcome(false)} />}
      {showSafe && <ShopSafeSheet item={item} onClose={() => setShowSafe(false)} />}
    </FadeInView>
    </View>
    </GestureDetector>
  );
}

const SC = StyleSheet.create({
  card: {
    backgroundColor: D.card, borderRadius: 22,
    borderWidth: 1, borderColor: D.border, padding: 16,
    marginBottom: 12,
  },
  cardDragging: { opacity: 0.25, transform: [{ scale: 0.97 }] },
  ghost: {
    position: 'absolute', top: 0, left: 0, zIndex: 999, width: 80, height: 80,
    backgroundColor: D.card, borderRadius: R.xl, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
    ...Shadow.card,
  },
  ghostIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ghostLabel: { ...T.bold, fontSize: 10, color: D.textMuted, maxWidth: 64, textAlign: 'center' },

  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { ...T.bold, fontSize: 15.5, color: D.textPrimary, letterSpacing: -0.2 },
  context: { ...T.medium, fontSize: 12.5, color: D.textMuted, marginTop: 2 },
  contextDim: { ...T.regular, color: D.textDisabled },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  renameInput: { ...T.bold, fontSize: 15, color: D.textPrimary, flex: 1, borderBottomWidth: 1, borderBottomColor: D.coral, paddingVertical: 2 },

  hook: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, fontStyle: 'italic', marginTop: 12 },

  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: D.divider },
  stripLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  stripRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: R.full, borderWidth: 1, borderColor: D.border, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { ...T.bold, fontSize: 11, color: D.textMuted },
  chipLime: { backgroundColor: D.limeSubtle, borderColor: 'transparent' },
  chipLimeText: { color: D.limeDeep },
  chipCoral: { backgroundColor: D.coralSubtle, borderColor: 'transparent' },
  chipCoralText: { color: D.coral },
  iconBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnCoral: { backgroundColor: D.coralSubtle, borderColor: D.coral + '22' },
  iconBtnInk: { backgroundColor: D.ink, borderColor: D.ink },

  divider: { height: 1, backgroundColor: D.divider, marginVertical: 12 },
  scriptText: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 22, marginBottom: 4 },
  ctaRow: { backgroundColor: D.inkCard, borderRadius: R.md, padding: 10, marginTop: 8, marginBottom: 10 },
  ctaLabel: { ...T.bold, fontSize: 10, color: D.lime, letterSpacing: 1.2, marginBottom: 3 },
  ctaText: { ...T.medium, fontSize: 12, color: '#FFF', lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: D.divider, marginTop: 8 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: D.surface,
    borderWidth: 1, borderColor: D.border,
  },
  folderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: R.md,
    backgroundColor: D.coralSubtle, borderWidth: 1, borderColor: D.coral + '30',
  },
  actionText: { ...T.bold, fontSize: 11.5, color: D.textMuted },
  folderBtnText: { ...T.medium, fontSize: 12, color: D.coral },
});

// ── Folder card ────────────────────────────────────────────────────────────



// ── Create folder sheet ────────────────────────────────────────────────────

function CreateFolderSheet({ onDone, onClose }: {
  onDone: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);

  return (
    <FadeInView direction="up" style={CFS.panel}>
      <View style={CFS.grabber} />
      <View style={CFS.hdr}>
        <Text style={CFS.hdrTitle}>New Folder</Text>
        <TouchableOpacity onPress={onClose} style={CFS.closeBtn} hitSlop={12}>
          <X size={17} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={CFS.body}>
        <Text style={CFS.fieldLabel}>FOLDER NAME</Text>
        <TextInput
          style={CFS.input}
          placeholder="e.g. Mushroom Gummies, Summer Campaign..."
          placeholderTextColor={D.textDisabled}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={40}
        />

        <Text style={[CFS.fieldLabel, { marginTop: 20 }]}>COLOR</Text>
        <View style={CFS.colorRow}>
          {FOLDER_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[CFS.colorSwatch, { backgroundColor: c }, color === c && CFS.colorSwatchActive]}
              onPress={() => setColor(c)}
              activeOpacity={0.8}
            >
              {color === c && <Check size={14} color="#FFF" strokeWidth={3} />}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[CFS.createBtn, !name.trim() && { opacity: 0.35 }]}
          onPress={() => name.trim() && onDone(name.trim(), color)}
          disabled={!name.trim()}
          activeOpacity={0.85}
        >
          <Plus size={15} color="#FFF" strokeWidth={2.5} />
          <Text style={CFS.createBtnText}>Create Folder</Text>
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}

const CFS = StyleSheet.create({
  panel: {
    width: '100%',
    backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.border, paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    ...Shadow.card,
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 5, borderRadius: 3,
    backgroundColor: D.border, marginTop: 10, marginBottom: 2,
  },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  hdrTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  fieldLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 10 },
  input: {
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 14, ...T.regular, fontSize: 15, color: D.textPrimary,
  },
  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorSwatch: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: D.coral, borderRadius: R.full,
    paddingVertical: 16, marginTop: 24,
  },
  createBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
});

// ── Add to folder sheet ────────────────────────────────────────────────────

function AddToFolderSheet({ item, folders, onToggle, onClose, onCreateFolder }: {
  item: SavedScriptItem;
  folders: FolderData[];
  onToggle: (folderId: string) => void;
  onClose: () => void;
  onCreateFolder: () => void;
}) {
  return (
    <FadeInView direction="up" style={ATF.panel}>
      <View style={ATF.grabber} />
      <View style={ATF.hdr}>
        <Text style={ATF.hdrTitle}>Add to Folder</Text>
        <TouchableOpacity onPress={onClose} style={ATF.closeBtn} hitSlop={12}>
          <X size={17} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={ATF.scrollContent} showsVerticalScrollIndicator={false}>
        {item.hook ? (
          <View style={ATF.hookPreview}>
            <Text style={ATF.hookPreviewText} numberOfLines={2}>"{item.hook}"</Text>
          </View>
        ) : null}

        {folders.length === 0 ? (
          <Text style={ATF.emptyText}>No folders yet — create one below.</Text>
        ) : (
          folders.map((f) => {
            const inFolder = f.scriptIds.includes(item.id);
            return (
              <TouchableOpacity key={f.id} style={ATF.folderRow} onPress={() => onToggle(f.id)} activeOpacity={0.8}>
                <View style={[ATF.folderIcon, { backgroundColor: f.color + '18' }]}>
                  <Folder size={16} color={f.color} strokeWidth={2} />
                </View>
                <Text style={ATF.folderName}>{f.name}</Text>
                <View style={[ATF.check, inFolder && { backgroundColor: D.coral, borderColor: D.coral }]}>
                  {inFolder && <Check size={10} color="#FFF" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity style={ATF.newFolderBtn} onPress={onCreateFolder} activeOpacity={0.8}>
          <Plus size={14} color={D.coral} strokeWidth={2.5} />
          <Text style={ATF.newFolderText}>New folder</Text>
        </TouchableOpacity>
      </ScrollView>
    </FadeInView>
  );
}

const ATF = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.border, ...Shadow.card,
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 5, borderRadius: 3,
    backgroundColor: D.border, marginTop: 10, marginBottom: 2,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  hdrTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  hookPreview: { backgroundColor: D.coralFaint, borderRadius: R.sm, padding: 10, marginBottom: 14 },
  hookPreviewText: { ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 19, fontStyle: 'italic' },
  emptyText: { ...T.regular, fontSize: 14, color: D.textMuted, textAlign: 'center', paddingVertical: 20 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: D.divider },
  folderIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  folderName: { flex: 1, ...T.medium, fontSize: 14, color: D.textPrimary },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  newFolderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  newFolderText: { ...T.medium, fontSize: 14, color: D.coral },
});

// ── Folder detail view ─────────────────────────────────────────────────────

function FolderDetail({
  folder, scripts, allFolders,
  onBack, onRemove, onAddToFolder,
}: {
  folder: FolderData;
  scripts: SavedScriptItem[];
  allFolders: FolderData[];
  onBack: () => void;
  onRemove: (scriptId: string) => void;
  onAddToFolder: (item: SavedScriptItem) => void;
}) {
  const folderScripts = scripts.filter((s) => folder.scriptIds.includes(s.id));

  return (
    <View style={{ flex: 1 }}>
      {/* Folder header */}
      <View style={[FD.hdr, { borderBottomColor: folder.color }]}>
        <TouchableOpacity style={FD.backBtn} onPress={onBack} activeOpacity={0.75} hitSlop={10}>
          <ChevronLeft size={20} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
        <LinearGradient
          colors={[folder.color + 'E6', folder.color]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={FD.iconBox}
        >
          <FolderOpen size={16} color="#FFF" strokeWidth={2} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={FD.name}>{folder.name}</Text>
          <Text style={FD.count}>{folderScripts.length} script{folderScripts.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={FD.scroll} showsVerticalScrollIndicator={false}>
        {folderScripts.length === 0 ? (
          <FadeInView direction="none" duration={300} style={FD.empty}>
            <View style={FD.emptyIcon}>
              <FolderOpen size={24} color={D.textDisabled} strokeWidth={1.5} />
            </View>
            <Text style={FD.emptyTitle}>Folder is empty</Text>
            <Text style={FD.emptySub}>Expand any script and tap "Add to folder" to file it here.</Text>
          </FadeInView>
        ) : (
          folderScripts.map((item, i) => (
            <FadeInView key={item.id} delay={i * 40} style={SC.card}>
              <View style={SC.top}>
                <View style={[SC.mark, { backgroundColor: originColor(item.origin) + '18' }]}>
                  <OriginIcon origin={item.origin} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={SC.title} numberOfLines={1}>{item.option_label ?? item.product_name ?? 'Untitled'}</Text>
                  <Text style={SC.context} numberOfLines={1}>
                    {item.product_name ? item.product_name : originLabel(item.origin)}
                    <Text style={SC.contextDim}>  ·  {relDate(item.created_at)}</Text>
                  </Text>
                </View>
                <TouchableOpacity style={SC.iconBtn} onPress={() => onRemove(item.id)} hitSlop={6} activeOpacity={0.7}>
                  <X size={14} color={D.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              {item.hook ? <Text style={SC.hook} numberOfLines={2}>“{item.hook}”</Text> : null}
              <View style={SC.strip}>
                <View style={SC.stripLeft}>
                  {item.shop_safe_grade
                    ? <GradePill grade={item.shop_safe_grade} />
                    : <View style={SC.chip}><Text style={SC.chipText}>Shop Safe</Text></View>}
                </View>
                <View style={SC.stripRight}>
                  <CopyButton item={item} />
                  <TouchableOpacity style={[SC.iconBtn, SC.iconBtnCoral]} onPress={() => onAddToFolder(item)} hitSlop={6} activeOpacity={0.7}>
                    <FolderPlus size={14} color={D.coral} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>
            </FadeInView>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function CopyButton({ item }: { item: SavedScriptItem }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void Clipboard.setStringAsync(item.full_script ?? item.hook ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <TouchableOpacity style={SC.copyBtn} onPress={handleCopy} activeOpacity={0.75}>
      {copied
        ? <><Check size={13} color={D.success} strokeWidth={2.5} /><Text style={[SC.actionText, { color: D.success }]}>Copied!</Text></>
        : <><Copy size={13} color={D.textMuted} strokeWidth={2} /><Text style={SC.actionText}>Copy</Text></>
      }
    </TouchableOpacity>
  );
}

const FD = StyleSheet.create({
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: 3,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.3 },
  count: { ...T.regular, fontSize: 12, color: D.textMuted, marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 },
  scriptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  folderActions: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: D.divider, marginTop: 10 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...T.bold, fontSize: 18, color: D.textSecondary },
  emptySub: { ...T.regular, fontSize: 14, color: D.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
});

// ── Main screen ────────────────────────────────────────────────────────────

export default function ToolkitScreen() {
  const { profile } = useAuth();
  const creatorId = profile?.id ?? null;
  const queryClient = useQueryClient();

  const screenOpacity = useRef(new Animated.Value(1)).current;
  useFocusEffect(useCallback(() => {
    screenOpacity.setValue(0);
    Animated.timing(screenOpacity, { toValue: 1, duration: 180, easing: Ease.out, useNativeDriver: true }).start();
  }, []));

  const { seg: segParam } = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg]                                 = useState<'scripts' | 'products' | 'videos'>(segParam === 'videos' || segParam === 'products' ? segParam : 'scripts');
  // Deep links (e.g. the teleprompter's Takes button) can switch the shelf.
  useEffect(() => { if (segParam === 'videos' || segParam === 'products' || segParam === 'scripts') setSeg(segParam); }, [segParam]);

  // Counts for the asset tiles (cheap, cached; the views own the full data).
  const { data: savedProductsLite } = useQuery({
    queryKey: ['saved-products-lite'],
    queryFn: async () => {
      const res = await api.get('/creators/saved-products');
      return extractData<{ products?: SavedProductItem[] }>(res)?.products ?? [];
    },
    staleTime: 60_000,
  });
  const { data: shopLite } = useQuery<ShopDashboard>({
    queryKey: ['shop-dashboard'],
    queryFn: async () => {
      const res = await api.get('/creators/me/shop-dashboard');
      return extractData<ShopDashboard>(res) as ShopDashboard;
    },
    staleTime: 5 * 60_000,
  });
  const { data: takesLite } = useQuery({
    queryKey: ['takes'],
    queryFn: async () => extractData<{ takes: unknown[] }>(await api.get('/creators/takes'))?.takes ?? [],
    staleTime: 60_000,
  });
  const productCount = savedProductsLite?.length ?? 0;
  const videoCount = (takesLite?.length ?? 0) + (shopLite?.top_videos?.length ?? 0);
  const [selectedFolderId, setSelectedFolderId]       = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder]       = useState(false);
  const [addingScript, setAddingScript]               = useState<SavedScriptItem | null>(null);
  const [pendingFolder, setPendingFolder]             = useState(false);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [dragScript, setDragScript]                   = useState<SavedScriptItem | null>(null);
  const [hoveredFolderId, setHoveredFolderId]         = useState<string | null>(null);
  // Drag-ghost position via a core Animated.ValueXY — updated with setValue on
  // each pan move so the ghost tracks the finger without re-rendering the list.
  const ghostPos                                      = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScriptRef                                 = useRef<SavedScriptItem | null>(null);
  const rootViewRef                                   = useRef<View>(null);
  const rootScreenXRef                                = useRef(0);
  const rootScreenYRef                                = useRef(0);
  const folderWrapperRefs                             = useRef<Record<string, View | null>>({});
  const folderScreenBounds                            = useRef<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const lastAbsPos                                    = useRef({ x: 0, y: 0 });
  const handleToggleFolderRef                         = useRef<(fId: string, sId: string) => void>(() => {});

  const { data, isLoading, isError, refetch, isFetching } = useQuery<SavedScriptItem[]>({
    queryKey: ['saved-scripts'],
    queryFn: async () => {
      const res = await api.get('/creators/scripts');
      const d = extractData<SavedScriptsResponse>(res);
      return d?.scripts ?? (Array.isArray(d) ? d : []);
    },
    staleTime: 60_000,
  });

  const scripts = data ?? [];

  // ── Folders (Creator API) ─────────────────────────────────────────────
  // One call returns folder rows + junction rows together; we compose them
  // into FolderData so the rest of the UI keeps consuming the same
  // `{ ...scriptIds }` shape.

  const foldersKey = ['script-folders', creatorId] as const;

  const { data: sfData, isLoading: foldersLoading } = useQuery<{
    folders: ScriptFolderRow[];
    items: ScriptFolderItemRow[];
  }>({
    queryKey: foldersKey,
    queryFn: async () => {
      if (!creatorId) return { folders: [], items: [] };
      const res = await api.get('/creators/script-folders');
      const d = extractData<{ folders: ScriptFolderRow[]; items: ScriptFolderItemRow[] }>(res);
      return { folders: d?.folders ?? [], items: d?.items ?? [] };
    },
    enabled: !!creatorId,
    staleTime: 60_000,
  });

  const folderRows = sfData?.folders ?? [];
  const folderItemRows = sfData?.items ?? [];

  const folders: FolderData[] = useMemo(
    () => folderRows.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      createdAt: f.created_at,
      scriptIds: folderItemRows.filter((it) => it.folder_id === f.id).map((it) => it.script_id),
    })),
    [folderRows, folderItemRows],
  );

  const foldersLoaded = !foldersLoading;
  const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) ?? null : null;

  // Optimistically flip a script's membership in a folder, then reconcile.
  const setMembership = useCallback((folderId: string, scriptId: string, inFolder: boolean) => {
    queryClient.setQueryData<{ folders: ScriptFolderRow[]; items: ScriptFolderItemRow[] }>(
      ['script-folders', creatorId],
      (prev) => {
        if (!prev) return prev;
        const list = prev.items;
        if (inFolder) {
          if (list.some((it) => it.folder_id === folderId && it.script_id === scriptId)) return prev;
          return { ...prev, items: [...list, { folder_id: folderId, script_id: scriptId }] };
        }
        return { ...prev, items: list.filter((it) => !(it.folder_id === folderId && it.script_id === scriptId)) };
      },
    );
  }, [queryClient, creatorId]);

  // ── One-time migration: push any local folders up to the Creator API ────
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!creatorId || foldersLoading || migratedRef.current) return;
    migratedRef.current = true;
    (async () => {
      if (await storage.getItem(migratedKey(creatorId))) return;
      let local: FolderData[] = [];
      try {
        const raw = await storage.getItem(storageKey(creatorId));
        local = raw ? JSON.parse(raw) : [];
      } catch { local = []; }
      if (local.length) {
        try {
          for (const lf of local) {
            let nf: ScriptFolderRow | undefined;
            try {
              const res = await api.post('/creators/script-folders', { name: lf.name, color: lf.color });
              nf = extractData<{ folder: ScriptFolderRow }>(res)?.folder;
            } catch { nf = undefined; }
            if (!nf) continue;
            for (const sid of lf.scriptIds) {
              // A script that no longer exists server-side is skipped (FK reject).
              try {
                await api.post('/creators/script-folders/items', { folder_id: nf.id, script_id: sid });
              } catch {}
            }
          }
          queryClient.invalidateQueries({ queryKey: foldersKey });
        } catch {}
      }
      await storage.setItem(migratedKey(creatorId), '1');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId, foldersLoading]);

  // ── Folder actions ────────────────────────────────────────────────────

  const handleCreateFolder = async (name: string, color: string) => {
    setShowCreateFolder(false);
    if (pendingFolder) setPendingFolder(false);
    if (!creatorId) return;
    try {
      await api.post('/creators/script-folders', { name, color });
      queryClient.invalidateQueries({ queryKey: foldersKey });
    } catch (err: any) {
      Alert.alert('Couldn’t create folder', err?.response?.data?.error?.message ?? err?.message ?? 'Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (selectedFolderId === folderId) setSelectedFolderId(null);
    try {
      await api.delete(`/creators/script-folders/${folderId}`);
      queryClient.invalidateQueries({ queryKey: foldersKey });
    } catch (err: any) {
      Alert.alert('Couldn’t delete folder', err?.response?.data?.error?.message ?? err?.message ?? 'Please try again.');
    }
  };

  const handleToggleFolderItem = async (folderId: string) => {
    if (!addingScript || !creatorId) return;
    const scriptId = addingScript.id;
    const inFolder = folders.find((f) => f.id === folderId)?.scriptIds.includes(scriptId) ?? false;
    setMembership(folderId, scriptId, !inFolder); // optimistic
    try {
      if (inFolder) {
        await api.delete('/creators/script-folders/items', { params: { folder_id: folderId, script_id: scriptId } });
      } else {
        await api.post('/creators/script-folders/items', { folder_id: folderId, script_id: scriptId });
      }
    } catch {
      setMembership(folderId, scriptId, inFolder); // roll back
      queryClient.invalidateQueries({ queryKey: foldersKey });
    }
  };

  const handleRemoveFromFolder = async (folderId: string, scriptId: string) => {
    setMembership(folderId, scriptId, false); // optimistic
    try {
      await api.delete('/creators/script-folders/items', { params: { folder_id: folderId, script_id: scriptId } });
    } catch {
      setMembership(folderId, scriptId, true); // roll back
      queryClient.invalidateQueries({ queryKey: foldersKey });
    }
  };

  const addScriptToFolder = useCallback(async (folderId: string, scriptId: string) => {
    if (!creatorId) return;
    const already = (queryClient.getQueryData<{ items: ScriptFolderItemRow[] }>(['script-folders', creatorId])?.items ?? [])
      .some((it) => it.folder_id === folderId && it.script_id === scriptId);
    if (already) return;
    setMembership(folderId, scriptId, true); // optimistic
    try {
      await api.post('/creators/script-folders/items', { folder_id: folderId, script_id: scriptId });
    } catch {
      setMembership(folderId, scriptId, false); // roll back
      queryClient.invalidateQueries({ queryKey: foldersKey });
    }
  }, [creatorId, queryClient, setMembership]);

  handleToggleFolderRef.current = addScriptToFolder;

  // ── Drag callbacks ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((item: SavedScriptItem, absX: number, absY: number) => {
    rootViewRef.current?.measureInWindow((x, y) => { rootScreenXRef.current = x; rootScreenYRef.current = y; });
    for (const [id, ref] of Object.entries(folderWrapperRefs.current)) {
      ref?.measureInWindow((x, y, w, h) => { folderScreenBounds.current[id] = { x, y, w, h }; });
    }
    dragScriptRef.current = item;
    setDragScript(item);
    // Offset by half the 80px ghost so it centers on the finger.
    ghostPos.setValue({ x: absX - rootScreenXRef.current - 40, y: absY - rootScreenYRef.current - 40 });
    lastAbsPos.current = { x: absX, y: absY };
  }, [ghostPos]);

  const handleDragMove = useCallback((absX: number, absY: number) => {
    ghostPos.setValue({ x: absX - rootScreenXRef.current - 40, y: absY - rootScreenYRef.current - 40 });
    lastAbsPos.current = { x: absX, y: absY };
    let found: string | null = null;
    for (const [id, bounds] of Object.entries(folderScreenBounds.current)) {
      if (absX >= bounds.x && absX <= bounds.x + bounds.w &&
          absY >= bounds.y && absY <= bounds.y + bounds.h) {
        found = id; break;
      }
    }
    setHoveredFolderId((prev) => (prev === found ? prev : found));
  }, [ghostPos]);

  const handleDragEnd = useCallback(() => {
    if (!dragScriptRef.current) return; // already handled / never started
    const { x, y } = lastAbsPos.current;
    let dropped: string | null = null;
    for (const [id, bounds] of Object.entries(folderScreenBounds.current)) {
      if (x >= bounds.x && x <= bounds.x + bounds.w &&
          y >= bounds.y && y <= bounds.y + bounds.h) {
        dropped = id; break;
      }
    }
    if (dropped) {
      if (Platform.OS !== 'web') {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      }
      handleToggleFolderRef.current(dropped, dragScriptRef.current.id);
    }
    dragScriptRef.current = null;
    setDragScript(null);
    setHoveredFolderId(null);
  }, []);

  // Safety net — fires on every gesture finalize; clears state if a drag was
  // active but onEnd never ran (system cancel). No-op after a normal drop.
  const handleDragCancel = useCallback(() => {
    if (dragScriptRef.current) {
      dragScriptRef.current = null;
      setDragScript(null);
      setHoveredFolderId(null);
    }
  }, []);

  // Unfiled = not in ANY folder
  const allFiledIds = new Set(folders.flatMap((f) => f.scriptIds));
  const unfiledScripts = scripts.filter((s) => !allFiledIds.has(s.id));

  // ── Content ───────────────────────────────────────────────────────────

  if (selectedFolder) {
    return (
      <Animated.View style={[S.root, { opacity: screenOpacity }]}>
        <FolderDetail
          folder={selectedFolder}
          scripts={scripts}
          allFolders={folders}
          onBack={() => setSelectedFolderId(null)}
          onRemove={(scriptId) => handleRemoveFromFolder(selectedFolder.id, scriptId)}
          onAddToFolder={(item) => setAddingScript(item)}
        />
        {addingScript && (
          <FadeInView direction="none" duration={180} style={S.overlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddingScript(null)} activeOpacity={1} />
            <AddToFolderSheet
              item={addingScript}
              folders={folders}
              onToggle={handleToggleFolderItem}
              onClose={() => setAddingScript(null)}
              onCreateFolder={() => { setAddingScript(null); setShowCreateFolder(true); }}
            />
          </FadeInView>
        )}
        <Modal visible={showCreateFolder} transparent animationType="fade" onRequestClose={() => setShowCreateFolder(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={S.modalOverlay}
          >
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowCreateFolder(false)} activeOpacity={1} />
            <CreateFolderSheet
              onDone={handleCreateFolder}
              onClose={() => setShowCreateFolder(false)}
            />
          </KeyboardAvoidingView>
        </Modal>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[S.root, { opacity: screenOpacity }]}
      ref={rootViewRef as any}
      onLayout={() => rootViewRef.current?.measureInWindow((x, y) => { rootScreenXRef.current = x; rootScreenYRef.current = y; })}
    >
      {/* Header */}
      <FadeInView style={S.head}>
        <Text style={S.title}>Saved</Text>
        <Text style={S.sub}>Everything you've kept, in one place.</Text>
      </FadeInView>

      {/* Asset tiles double as the switcher */}
      <View style={S.tiles}>
        {([
          { k: 'scripts' as const, label: 'Scripts', n: scripts.length, Icon: BookOpen },
          { k: 'products' as const, label: 'Products', n: productCount, Icon: ShoppingBag },
          { k: 'videos' as const, label: 'Videos', n: videoCount, Icon: Film },
        ]).map(({ k, label, n, Icon }) => {
          const on = seg === k;
          return (
            <TouchableOpacity key={k} style={[S.tile, on && S.tileOn]} onPress={() => setSeg(k)} activeOpacity={0.85}>
              <View style={[S.tileIcon, on && S.tileIconOn]}>
                <Icon size={15} color={on ? '#FFF' : D.textMuted} strokeWidth={2.2} />
              </View>
              <Text style={[S.tileNum, on && S.tileNumOn]}>{n}</Text>
              <Text style={[S.tileLabel, on && S.tileLabelOn]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {seg === 'products' ? <SavedProductsView /> : seg === 'videos' ? <SavedVideosView /> : (
      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragScript}
      >

        {/* Folders section */}
        <View style={S.toolbar}>
          <Text style={[S.sectionLabel, { marginBottom: 0 }]}>
            FOLDERS{dragScript ? <Text style={{ color: D.coral }}>{'   ↑ drop to file'}</Text> : ''}
          </Text>
          <TouchableOpacity style={S.newBtn} onPress={() => setShowCreateFolder(true)} activeOpacity={0.85} hitSlop={6}>
            <FolderPlus size={13} color={D.coral} strokeWidth={2.4} />
            <Text style={S.newBtnText}>New folder</Text>
          </TouchableOpacity>
        </View>
        {foldersLoaded && folders.length > 0 && (
          <View style={S.section}>
            <View style={S.folderGrid}>
              {folders.map((f) => {
                const count = scripts.filter((s) => f.scriptIds.includes(s.id)).length;
                return (
                  <View
                    key={f.id}
                    style={S.folderCell}
                    ref={(r) => { folderWrapperRefs.current[f.id] = r as View | null; }}
                  >
                    <FolderCard
                      name={f.name}
                      color={f.color}
                      countLabel={`${count} script${count !== 1 ? 's' : ''}`}
                      onPress={() => !dragScript && setSelectedFolderId(f.id)}
                      onDelete={() => handleDeleteFolder(f.id)}
                      isDropTarget={hoveredFolderId === f.id}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Scripts section */}
        {isLoading && (
          <View style={S.section}>
            <Skeleton width={120} height={12} style={{ marginBottom: 13 }} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={72} radius={R.xl} style={{ marginBottom: 10 }} />
            ))}
          </View>
        )}

        {isError && !isLoading && (
          <FadeInView direction="none" duration={300} style={S.emptyState}>
            <AlertTriangle size={26} color={D.warning} strokeWidth={1.5} />
            <Text style={S.emptyTitle}>Couldn't load scripts</Text>
            <TouchableOpacity style={S.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
              <Text style={S.retryText}>Try again</Text>
            </TouchableOpacity>
          </FadeInView>
        )}

        {!isLoading && !isError && scripts.length === 0 && (
          <FadeInView style={S.emptyState}>
            <View style={S.emptyIcon}>
              <BookOpen size={26} color={D.textDisabled} strokeWidth={1.5} />
            </View>
            <Text style={S.emptyTitle}>Nothing saved yet</Text>
            <Text style={S.emptySub}>Write a script in ScriptIQ and save it — it lands here, checked by Shop Safe, ready to file.</Text>
          </FadeInView>
        )}

        {!isLoading && scripts.length > 0 && (
          <>
            {unfiledScripts.length > 0 && (
              <View style={S.section}>
                <Text style={[S.sectionLabel, { marginTop: 4 }]}>
                  {folders.length > 0 ? 'UNFILED' : 'ALL SCRIPTS'}
                  <Text style={S.sectionCount}> · {unfiledScripts.length}</Text>
                </Text>
                {unfiledScripts.map((item, i) => (
                  <ScriptCard
                    key={item.id}
                    item={item}
                    index={i}
                    folders={folders}
                    onAddToFolder={(s) => setAddingScript(s)}
                    isDraggingThis={dragScript?.id === item.id}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                  />
                ))}
              </View>
            )}

            {folders.length > 0 && unfiledScripts.length === 0 && (
              <View style={S.allFiledMsg}>
                <Zap size={14} color={D.limeDeep} strokeWidth={2} />
                <Text style={S.allFiledText}>All scripts are organized into folders.</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
      )}

      {/* Add to folder overlay */}
      {addingScript && (
        <FadeInView direction="none" duration={180} style={S.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddingScript(null)} activeOpacity={1} />
          <AddToFolderSheet
            item={addingScript}
            folders={folders}
            onToggle={handleToggleFolderItem}
            onClose={() => setAddingScript(null)}
            onCreateFolder={() => { setAddingScript(null); setPendingFolder(true); setShowCreateFolder(true); }}
          />
        </FadeInView>
      )}

      {/* Create folder overlay */}
      <Modal visible={showCreateFolder} transparent animationType="fade" onRequestClose={() => { setShowCreateFolder(false); setPendingFolder(false); }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={S.modalOverlay}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setShowCreateFolder(false); setPendingFolder(false); }} activeOpacity={1} />
          <CreateFolderSheet
            onDone={handleCreateFolder}
            onClose={() => { setShowCreateFolder(false); setPendingFolder(false); }}
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* Drag ghost — small square that follows the finger (no re-render) */}
      {dragScript && (
        <Animated.View
          style={[SC.ghost, { borderColor: originColor(dragScript.origin), transform: [...ghostPos.getTranslateTransform(), { scale: 1.05 }] }]}
          pointerEvents="none"
        >
          <View style={[SC.ghostIcon, { backgroundColor: originColor(dragScript.origin) + '18' }]}>
            <OriginIcon origin={dragScript.origin} size={20} />
          </View>
          <Text style={SC.ghostLabel} numberOfLines={1}>
            {dragScript.option_label ?? dragScript.product_name ?? 'Script'}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },

  // ── Hero header (coral gradient, on-brand) ──────────────────────────────
  hero: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 12,
    borderRadius: R.xxl, padding: 18, overflow: 'hidden',
    ...Shadow.coral,
  },
  heroRadial: {
    position: 'absolute', top: -46, right: -34, width: 170, height: 170,
    borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroTitle: { ...T.bold, fontSize: 24, color: '#FFF', letterSpacing: -0.6 },
  heroSub: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  heroRefresh: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroNewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#FFF', borderRadius: R.full,
    paddingVertical: 12, marginTop: 16,
  },
  heroNewText: { ...T.bold, fontSize: 14, color: D.coral, letterSpacing: -0.2 },

  scroll: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 },
  head: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  title: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8, lineHeight: 34 },
  sub: { ...T.regular, fontSize: 14, color: D.textMuted, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: D.card, borderRadius: 18, borderWidth: 1, borderColor: D.border, padding: 12, gap: 6 },
  tilesWrap: { marginBottom: 6 },
  tileOn: { backgroundColor: D.ink, borderColor: D.ink },
  tileIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: D.inkHairline, alignItems: 'center', justifyContent: 'center' },
  tileIconOn: { backgroundColor: 'rgba(255,255,255,0.16)' },
  tileNum: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.6, marginTop: 2 },
  tileNumOn: { color: '#FFF' },
  tileLabel: { ...T.medium, fontSize: 12.5, color: D.textMuted },
  tileLabelOn: { color: 'rgba(255,255,255,0.72)' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: D.coralSubtle, borderRadius: R.full, paddingHorizontal: 11, paddingVertical: 6 },
  newBtnText: { ...T.bold, fontSize: 12.5, color: D.coral },
  seg: { flexDirection: 'row', gap: 6, marginHorizontal: 20, marginTop: 14, marginBottom: 10, backgroundColor: D.inkHairline, borderRadius: R.full, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: R.full },
  segBtnOn: { backgroundColor: D.ink },
  segTxt: { ...T.bold, fontSize: 13.5, color: D.textMuted },
  segTxtOn: { color: '#FFF' },

  section: { marginBottom: 12 },
  sectionLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 12 },
  sectionCount: { ...T.regular, color: D.textDisabled },

  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  folderCell: { width: '48%' },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...T.bold, fontSize: 20, color: D.textSecondary },
  emptySub: { ...T.regular, fontSize: 14, color: D.textMuted, textAlign: 'center', lineHeight: 22 },
  retryBtn: { backgroundColor: D.coralSubtle, borderRadius: R.full, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: D.coral + '40' },
  retryText: { ...T.bold, fontSize: 13, color: D.coral },

  allFiledMsg: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 16, justifyContent: 'center' },
  allFiledText: { ...T.regular, fontSize: 13, color: D.textMuted },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,20,38,0.55)', justifyContent: 'flex-end' },
  // Full-screen flex container for Modal-hosted sheets — lets KeyboardAvoidingView
  // measure correctly and lift the sheet above the keyboard natively.
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,20,38,0.55)', justifyContent: 'flex-end' },
});
