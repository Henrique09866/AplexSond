import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { FolderCard } from '../components/FolderCard';
import { EmptyState } from '../components/EmptyState';
import { CreateFolderModal } from '../components/CreateFolderModal';
import { useFoldersStore, useLibraryStore } from '../store';
import { Folder } from '../core/entities';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SIZES,
  SHADOWS,
} from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP   = SPACING.md;
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.screenPadding * 2 - CARD_GAP) / 2;

// ─── Screen ───────────────────────────────────────────────────

export const FoldersScreen: React.FC = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const folders      = useFoldersStore((s) => s.folders);
  const createFolder = useFoldersStore((s) => s.createFolder);
  const deleteFolder = useFoldersStore((s) => s.deleteFolder);
  const reorderFolders = useFoldersStore((s) => s.reorderFolders);
  const tracks       = useLibraryStore((s) => s.tracks);

  const [showCreate, setShowCreate] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // ── Get up to 4 artwork URIs for a folder ──
  const getFolderArtworks = useCallback(
    (folder: Folder): (string | null)[] => {
      const folderTracks = tracks
        .filter((t) => t.folderId === folder.id)
        .slice(0, 4);
      return folderTracks.map((t) => t.artwork ?? null);
    },
    [tracks],
  );

  const handleCreate = useCallback(
    (name: string, color: string) => {
      createFolder(name, color);
      setShowCreate(false);
    },
    [createFolder],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string, folderName: string) => {
      await Alert.alert(
        'Excluir pasta',
        `Tem certeza que deseja excluir "${folderName}"? As músicas dentro dela continuarão na biblioteca, sem pasta.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              await deleteFolder(folderId);
            },
          },
        ],
      );
    },
    [deleteFolder],
  );

  const moveFolder = useCallback(
    (from: number, to: number) => {
      reorderFolders(from, to);
    },
    [reorderFolders],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Folder; index: number }) => {
      const count    = tracks.filter((t) => t.folderId === item.id).length;
      const artworks = getFolderArtworks(item);
      const canMoveLeft = index > 0;
      const canMoveRight = index < folders.length - 1;

      return (
        <View style={{ width: CARD_WIDTH }}>
          <FolderCard
            name={item.name}
            color={item.color}
            trackCount={count}
            artworks={artworks}
            artwork={item.artwork}
            isReordering={isReordering}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onMoveLeft={() => moveFolder(index, index - 1)}
            onMoveRight={() => moveFolder(index, index + 1)}
            onLongPress={() => setIsReordering(true)}
            onDeleteFolder={() => handleDeleteFolder(item.id, item.name)}
            onPress={() => {
              if (isReordering) return;
              navigation.navigate('FolderDetails', { folderId: item.id, folderName: item.name });
            }}
          />
        </View>
      );
    },
    [folders.length, getFolderArtworks, isReordering, moveFolder, navigation, tracks, handleDeleteFolder],
  );

  const keyExtractor = useCallback((item: Folder) => item.id, []);

  const ListHeader = (
    <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
      <Text style={styles.pageTitle}>Pastas</Text>

      <TouchableOpacity
        onPress={() => {
          if (isReordering) {
            setIsReordering(false);
            return;
          }
          setShowCreate(true);
        }}
        style={[styles.createButton, isReordering && styles.doneButton]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.buttonContent}>
          <Ionicons
            name={isReordering ? 'checkmark' : 'add'}
            size={18}
            color={isReordering ? COLORS.text.inverse : COLORS.text.onAccent}
          />
          <Text style={[styles.createButtonText, isReordering && styles.doneButtonText]}>
            {isReordering ? 'Concluir' : 'Nova pasta'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      <FlatList
        data={folders}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            icon="folder-outline"
            title="Nenhuma pasta ainda"
            subtitle='Toque em "+ Nova pasta" para organizar suas músicas'
          />
        }
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              insets.bottom +
              SPACING.tabBarHeight +
              SIZES.miniPlayerHeight +
              SPACING.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      />

      <CreateFolderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg.base,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: SPACING.screenPadding,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xl,
  },
  pageTitle: {
    ...TYPOGRAPHY.h1,
  },
  createButton: {
    backgroundColor: COLORS.accent.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.chip,
    ...SHADOWS.accentGlow,
  },
  createButtonText: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.onAccent,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  doneButton: {
    backgroundColor: COLORS.accent.bright,
  },
  doneButtonText: {
    color: COLORS.text.onAccent,
  },

  // ── Grid ──
  row: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
});
