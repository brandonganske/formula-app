import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Modal, Pressable, StyleSheet,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SavedProductItem, ProductFolder } from '@/types/api';
import { D, T, R, FOLDER_COLORS } from '@/constants/ds';
import { Bookmark, Check, Trash2, FolderOpen, FolderPlus } from 'lucide-react-native';
import { Skeleton } from '@/components/Skeleton';
import FolderCard, { FOLDER_GRID } from '@/components/FolderCard';
import { ChevronLeft } from 'lucide-react-native';
import { PanelSource, fromSavedItem, LearnPanel, SavedCard, FP, FM, S } from '@/components/products/shared';

// The creator's saved products, with folders. Rendered inside the Saved tab
// next to saved scripts; owns its own scroll view and overlays.
const PV = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: D.coralSubtle, borderRadius: R.full, paddingHorizontal: 11, paddingVertical: 6 },
  newBtnText: { ...T.bold, fontSize: 12.5, color: D.coral },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 12 },
  backText: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2, flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});

export default function SavedProductsView({ query = '' }: { query?: string }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const creatorId = profile?.id ?? null;

  const [isManaging, setIsManaging] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [movingProduct, setMovingProduct] = useState<SavedProductItem | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [viewingSaved, setViewingSaved] = useState<SavedProductItem | null>(null);

  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['saved-products', creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const res = await api.get('/creators/saved-products');
      return extractData<{ products: SavedProductItem[] }>(res)?.products ?? [];
    },
    enabled: !!creatorId,
    staleTime: 30_000,
  });

  const { data: folders = [] } = useQuery<ProductFolder[]>({
    queryKey: ['product-folders', creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const res = await api.get('/creators/product-folders');
      return extractData<{ folders: ProductFolder[] }>(res)?.folders ?? [];
    },
    enabled: !!creatorId,
    staleTime: 60_000,
  });

  const folderMap = React.useMemo(() => {
    const m: Record<string, ProductFolder> = {};
    folders.forEach((f) => { m[f.id] = f; });
    return m;
  }, [folders]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['saved-products', creatorId] });
    queryClient.invalidateQueries({ queryKey: ['saved-products-lite'] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/creators/saved-products/${id}`); },
    onSuccess: () => { invalidate(); setViewingSaved(null); },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const res = await api.post('/creators/product-folders', { name, color });
      const folder = extractData<{ folder: ProductFolder }>(res)?.folder;
      if (!folder) throw new Error('Failed to create folder');
      return folder;
    },
    onSuccess: (folder) => {
      queryClient.invalidateQueries({ queryKey: ['product-folders', creatorId] });
      setShowNewFolderModal(false);
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0]);
      setSelectedFolderId(folder.id);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => { await api.delete(`/creators/product-folders/${folderId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-folders', creatorId] });
      invalidate();
      setSelectedFolderId(null);
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ productId, folderId }: { productId: string; folderId: string | null }) => {
      await api.patch(`/creators/saved-products/${productId}`, { folder_id: folderId });
    },
    onSuccess: () => { invalidate(); setMovingProduct(null); },
  });

  const savedItems = savedData ?? [];
  const q = query.trim().toLowerCase();
  const searched = q ? savedItems.filter((i) => [i.title, i.shop_name, i.category].some((v) => (v ?? '').toLowerCase().includes(q))) : savedItems;
  const filteredItems = selectedFolderId && !q ? searched.filter((item) => item.folder_id === selectedFolderId) : searched;
  const viewingSavedSource: PanelSource | null = viewingSaved ? fromSavedItem(viewingSaved) : null;
  const selectedFolder = selectedFolderId ? folderMap[selectedFolderId] : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        {/* Folders — same tiles as saved scripts */}
        {!q && <View style={PV.toolbar}>
          <Text style={[S.sectionLabel, { marginBottom: 0 }]}>FOLDERS</Text>
          <TouchableOpacity style={PV.newBtn} onPress={() => setShowNewFolderModal(true)} activeOpacity={0.85} hitSlop={6}>
            <FolderPlus size={13} color={D.coral} strokeWidth={2.4} />
            <Text style={PV.newBtnText}>New folder</Text>
          </TouchableOpacity>
        </View>}
        {folders.length > 0 && !selectedFolderId && !q && (
          <View style={FOLDER_GRID.grid}>
            {folders.map((folder) => {
              const count = savedItems.filter((i) => i.folder_id === folder.id).length;
              return (
                <View key={folder.id} style={FOLDER_GRID.cell}>
                  <FolderCard
                    name={folder.name}
                    color={folder.color}
                    countLabel={`${count} product${count !== 1 ? 's' : ''}`}
                    onPress={() => setSelectedFolderId(folder.id)}
                    onDelete={() => setDeletingFolderId(folder.id)}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Products header: "All" or the open folder */}
        <View style={S.sectionHdr}>
          {q ? (
            <View style={S.sectionHdrLeft}>
              <Text style={S.sectionLabel}>RESULTS</Text>
              <View style={S.countBadge}><Text style={S.countBadgeTxt}>{filteredItems.length}</Text></View>
            </View>
          ) : selectedFolder ? (
            <TouchableOpacity style={PV.back} onPress={() => setSelectedFolderId(null)} activeOpacity={0.75} hitSlop={8}>
              <ChevronLeft size={16} color={D.coral} strokeWidth={2.4} />
              <View style={[PV.dot, { backgroundColor: selectedFolder.color }]} />
              <Text style={PV.backText} numberOfLines={1}>{selectedFolder.name}</Text>
            </TouchableOpacity>
          ) : (
            <View style={S.sectionHdrLeft}>
              <Text style={S.sectionLabel}>{folders.length > 0 ? 'ALL PRODUCTS' : 'SAVED PRODUCTS'}</Text>
              {savedItems.length > 0 && (
                <View style={S.countBadge}><Text style={S.countBadgeTxt}>{savedItems.length}</Text></View>
              )}
            </View>
          )}
          <TouchableOpacity onPress={() => setIsManaging((v) => !v)} hitSlop={10}>
            <Text style={[S.manageBtn, isManaging && { color: D.error }]}>{isManaging ? 'Done' : 'Manage'}</Text>
          </TouchableOpacity>
        </View>

        {isManaging && selectedFolder && (
          <TouchableOpacity style={S.deleteFolderRow} onPress={() => setDeletingFolderId(selectedFolder.id)} activeOpacity={0.75}>
            <Trash2 size={13} color={D.error} strokeWidth={1.8} />
            <Text style={S.deleteFolderTxt}>Delete folder "{selectedFolder.name}"</Text>
          </TouchableOpacity>
        )}

        {savedLoading ? (
          <View style={{ paddingTop: 4 }}>
            <Skeleton height={48} radius={R.md} style={{ marginBottom: 14 }} />
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} radius={R.xl} style={{ marginBottom: 10 }} />)}
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={S.emptyWrap}>
            <View style={S.emptyIcon}>
              {selectedFolderId
                ? <FolderOpen size={24} color={D.textDisabled} strokeWidth={1.5} />
                : <Bookmark size={24} color={D.textDisabled} strokeWidth={1.5} />}
            </View>
            <Text style={S.emptyTitle}>{q ? `No products match “${query.trim()}”` : selectedFolderId ? 'No products in this folder' : 'No saved products'}</Text>
            <Text style={S.emptySub}>
              {q ? 'Try a shorter word, or search TikTok Shop from the Products tab.' : selectedFolderId
                ? 'In manage mode, use the folder icon to move products here.'
                : 'Find a product on the Products tab, tap Learn, then save it.'}
            </Text>
          </View>
        ) : (
          filteredItems.map((item, i) => (
            <SavedCard
              key={item.id}
              item={item}
              onPress={() => setViewingSaved(item)}
              onDelete={() => deleteMutation.mutate(item.id)}
              onMove={() => setMovingProduct(item)}
              isManaging={isManaging}
              folderName={item.folder_id ? folderMap[item.folder_id]?.name : null}
              folderColor={item.folder_id ? folderMap[item.folder_id]?.color : null}
              index={i}
            />
          ))
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      {viewingSaved && viewingSavedSource && (
        <FadeInView direction="none" duration={200} style={S.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setViewingSaved(null)} activeOpacity={1} />
          <LearnPanel
            source={viewingSavedSource}
            onClose={() => setViewingSaved(null)}
            onSave={() => {}}
            onUnsave={() => { if (viewingSaved.id) deleteMutation.mutate(viewingSaved.id); }}
            saving={false}
            unsaving={deleteMutation.isPending}
          />
        </FadeInView>
      )}

      <Modal visible={showNewFolderModal} transparent animationType="fade" onRequestClose={() => setShowNewFolderModal(false)}>
        <Pressable style={FM.backdrop} onPress={() => setShowNewFolderModal(false)}>
          <Pressable style={FM.sheet} onPress={() => {}}>
            <Text style={FM.title}>New Folder</Text>
            <TextInput
              style={FM.input}
              placeholder="Folder name"
              placeholderTextColor={D.textDisabled}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              maxLength={40}
            />
            <Text style={FM.colorLabel}>Color</Text>
            <View style={FM.colorRow}>
              {FOLDER_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[FM.colorDot, { backgroundColor: color }, newFolderColor === color && FM.colorDotActive]}
                  onPress={() => setNewFolderColor(color)}
                  activeOpacity={0.8}
                >
                  {newFolderColor === color && <Check size={12} color="#fff" strokeWidth={3} />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={FM.actions}>
              <TouchableOpacity style={FM.cancelBtn} onPress={() => setShowNewFolderModal(false)} activeOpacity={0.75}>
                <Text style={FM.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[FM.createBtn, (!newFolderName.trim() || createFolderMutation.isPending) && { opacity: 0.5 }]}
                onPress={() => { if (newFolderName.trim()) createFolderMutation.mutate({ name: newFolderName.trim(), color: newFolderColor }); }}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                activeOpacity={0.85}
              >
                {createFolderMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={FM.createTxt}>Create</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!movingProduct} transparent animationType="slide" onRequestClose={() => setMovingProduct(null)}>
        <Pressable style={FM.backdrop} onPress={() => setMovingProduct(null)}>
          <Pressable style={[FM.sheet, { paddingBottom: 32 }]} onPress={() => {}}>
            <Text style={FM.title}>Move to Folder</Text>
            <Text style={FM.subtitle} numberOfLines={2}>{movingProduct?.title}</Text>
            <TouchableOpacity
              style={[FP.option, !movingProduct?.folder_id && FP.optionActive]}
              onPress={() => moveToFolderMutation.mutate({ productId: movingProduct!.id, folderId: null })}
              activeOpacity={0.75}
            >
              <View style={[FP.dot, { backgroundColor: D.textDisabled }]} />
              <Text style={FP.optionTxt}>No folder</Text>
              {!movingProduct?.folder_id && <Check size={15} color={D.coral} strokeWidth={2.5} />}
            </TouchableOpacity>
            {folders.map((folder) => {
              const active = movingProduct?.folder_id === folder.id;
              return (
                <TouchableOpacity
                  key={folder.id}
                  style={[FP.option, active && FP.optionActive]}
                  onPress={() => moveToFolderMutation.mutate({ productId: movingProduct!.id, folderId: folder.id })}
                  activeOpacity={0.75}
                >
                  <View style={[FP.dot, { backgroundColor: folder.color }]} />
                  <Text style={FP.optionTxt}>{folder.name}</Text>
                  {active && <Check size={15} color={D.coral} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
            {folders.length === 0 && (
              <Text style={{ ...T.regular, fontSize: 13, color: D.textMuted, textAlign: 'center', paddingVertical: 12 }}>
                No folders yet. Create one first.
              </Text>
            )}
            <TouchableOpacity
              style={[S.newFolderBtn, { alignSelf: 'center', marginTop: 12, paddingHorizontal: 18, paddingVertical: 10 }]}
              onPress={() => { setMovingProduct(null); setShowNewFolderModal(true); }}
              activeOpacity={0.75}
            >
              <FolderPlus size={14} color={D.textMuted} strokeWidth={1.8} />
              <Text style={S.newFolderTxt}>New Folder</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!deletingFolderId} transparent animationType="fade" onRequestClose={() => setDeletingFolderId(null)}>
        <Pressable style={FM.backdrop} onPress={() => setDeletingFolderId(null)}>
          <Pressable style={[FM.sheet, { paddingBottom: 28 }]} onPress={() => {}}>
            <Text style={FM.title}>Delete Folder</Text>
            <Text style={[FM.subtitle, { marginBottom: 24 }]}>Products in this folder won't be deleted — they'll just be unfoldered.</Text>
            <View style={FM.actions}>
              <TouchableOpacity style={FM.cancelBtn} onPress={() => setDeletingFolderId(null)} activeOpacity={0.75}>
                <Text style={FM.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[FM.createBtn, { backgroundColor: D.error }]}
                onPress={() => { if (deletingFolderId) deleteFolderMutation.mutate(deletingFolderId); setDeletingFolderId(null); }}
                activeOpacity={0.85}
              >
                <Text style={FM.createTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
