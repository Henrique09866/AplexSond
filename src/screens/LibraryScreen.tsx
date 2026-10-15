import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList as RNFlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { SongListItem } from '../components/SongListItem';
import { UserAvatar } from '../components/UserAvatar';
import { EmptyState } from '../components/EmptyState';
import { CreateFolderModal } from '../components/CreateFolderModal';
import { SelectFolderModal } from '../components/SelectFolderModal';
import { Playlist, useFoldersStore, useLibraryStore, usePlayerStore, usePlaylistsStore } from '../store';
import { useAuthStore } from '../store/useAuthStore';
import { Track } from '../core/entities';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SIZES,
} from '../constants/theme';

// ─── Screen ───────────────────────────────────────────────────

const normalize = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const SEARCH_FIELDS: ((t: Track) => string)[] = [
  (t) => t.title ?? '',
  (t) => t.artist ?? '',
];

type LibraryFilter = 'all' | 'recent' | 'foldered' | 'unfiled';

const FILTERS: { key: LibraryFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Todas', icon: 'albums-outline' },
  { key: 'recent', label: 'Recentes', icon: 'time-outline' },
  { key: 'foldered', label: 'Com pasta', icon: 'folder-outline' },
  { key: 'unfiled', label: 'Sem pasta', icon: 'file-tray-outline' },
];

const FilterChip: React.FC<{
  item: { key: LibraryFilter; label: string; icon: keyof typeof Ionicons.glyphMap };
  selected: boolean;
  onPress: () => void;
}> = ({ item, selected, onPress }) => {
  const scale = React.useRef(new Animated.Value(selected ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1 : 0,
      tension: 120,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [scale, selected]);

  const chipScale = scale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <Animated.View style={{ transform: [{ scale: chipScale }] }}>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.filterChip, selected && styles.filterChipActive]}
      >
        <Ionicons
          name={item.icon}
          size={16}
          color={selected ? COLORS.text.inverse : COLORS.text.secondary}
        />
        <Text style={[styles.filterText, selected && styles.filterTextActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const LibraryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const tracks       = useLibraryStore((s) => s.tracks);
  const importMusic  = useLibraryStore((s) => s.importMusic);
  const deleteTrack  = useLibraryStore((s) => s.deleteTrack);
  const updateTrackFolder = useLibraryStore((s) => s.updateTrackFolder);
  const updateTrack = useLibraryStore((s) => s.updateTrack);
  const markTrackPlayed = useLibraryStore((s) => s.markTrackPlayed);
  const folders      = useFoldersStore((s) => s.folders);
  const createFolder = useFoldersStore((s) => s.createFolder);
  const playlists = usePlaylistsStore((s) => s.playlists);
  const playlistsHydrated = usePlaylistsStore((s) => s.hydrated);
  const hydratePlaylists = usePlaylistsStore((s) => s.hydrate);
  const addTrackToPlaylist = usePlaylistsStore((s) => s.addTrackToPlaylist);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying    = usePlayerStore((s) => s.isPlaying);
  const playQueue    = usePlayerStore((s) => s.playQueue);
  const pause        = usePlayerStore((s) => s.pause);

  const profile = useAuthStore((s) => s.profile);

  const [query,   setQuery]   = useState('');
  const [filterMode, setFilterMode] = useState<LibraryFilter>('all');
  const [loading, setLoading] = useState(false);
  const [pendingFolderTrackIds, setPendingFolderTrackIds] = useState<string[]>([]);
  const [showImportFolderPrompt, setShowImportFolderPrompt] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showSelectFolder, setShowSelectFolder] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showTrackActions, setShowTrackActions] = useState(false);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [showRenameTrack, setShowRenameTrack] = useState(false);

  React.useEffect(() => {
    if (!playlistsHydrated) hydratePlaylists();
  }, [hydratePlaylists, playlistsHydrated]);

  // ── Filter ──
  const filtered = useMemo(() => {
    const byMode = tracks.filter((track) => {
      if (filterMode === 'recent') return Date.now() - track.createdAt < 1000 * 60 * 60 * 24 * 14;
      if (filterMode === 'foldered') return !!track.folderId;
      if (filterMode === 'unfiled') return !track.folderId;
      return true;
    });

    if (!query.trim()) return byMode;

    const q = normalize(query.trim());
    return byMode.filter((t) =>
      SEARCH_FIELDS.some((field) => normalize(field(t)).includes(q)),
    );
  }, [filterMode, tracks, query]);

  // ── Import ──
  const handleImport = useCallback(async () => {
    setLoading(true);
    try {
      const importedTracks = await importMusic();
      if (importedTracks.length > 0) {
        setPendingFolderTrackIds(importedTracks.map((track) => track.id));
        setShowImportFolderPrompt(true);
      }
    } finally {
      setLoading(false);
    }
  }, [importMusic]);

  const assignImportedTracksToFolder = useCallback(
    async (folderId: string | undefined) => {
      const ids = pendingFolderTrackIds;
      if (!ids.length) return;

      await Promise.all(ids.map((trackId) => updateTrackFolder(trackId, folderId)));
      setPendingFolderTrackIds([]);
    },
    [pendingFolderTrackIds, updateTrackFolder],
  );

  const handleCreateImportFolder = useCallback(
    async (name: string, color: string) => {
      const folder = await createFolder(name, color);
      await assignImportedTracksToFolder(folder.id);
      setShowCreateFolder(false);
    },
    [assignImportedTracksToFolder, createFolder],
  );

  const handleSelectImportFolder = useCallback(
    async (folderId: string | undefined) => {
      await assignImportedTracksToFolder(folderId);
      setShowSelectFolder(false);
    },
    [assignImportedTracksToFolder],
  );

  const dismissImportFolderPrompt = useCallback(() => {
    setShowImportFolderPrompt(false);
    setPendingFolderTrackIds([]);
  }, []);

  // ── Play a track (set full filtered list as queue) ──
  const handlePlay = useCallback(
    (track: Track, index: number) => {
      markTrackPlayed(track.id);
      playQueue(filtered, index);
      navigation.navigate('PlayerScene');
    },
    [filtered, markTrackPlayed, playQueue, navigation],
  );

  // ── Delete a track ──
  const handleDelete = useCallback(
    (track: Track) => {
      Alert.alert(
        'Excluir música',
        `Deseja excluir "${track.title}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              // Pause if this track is currently playing
              if (currentTrack?.id === track.id) {
                pause();
              }
              await deleteTrack(track.id);
            },
          },
        ],
      );
    },
    [currentTrack, pause, deleteTrack],
  );

  const handleLongPressTrack = useCallback(
    (track: Track) => {
      setSelectedTrack(track);
      setShowTrackActions(true);
    },
    [],
  );

  // ── Render item ──
  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <SongListItem
        id={item.id}
        title={item.title}
        artist={item.artist}
        duration={Math.floor(item.duration / 1000)}
        artwork={item.artwork}
        isPlaying={currentTrack?.id === item.id && isPlaying}
        isLoading={false}
        onPress={() => handlePlay(item, index)}
        onLongPress={() => handleLongPressTrack(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [currentTrack, isPlaying, handlePlay, handleDelete, handleLongPressTrack],
  );

  const keyExtractor = useCallback((item: Track) => item.id, []);

  const ListHeader = (
    <View>
      {/* ── Page title ── */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Perfil"
        >
          <UserAvatar
            photoURL={profile?.photoURL}
            initial={(profile?.displayName || 'AplexSond')
              .trim()
              .charAt(0)
              .toUpperCase()}
            size={SIZES.avatar.md}
            crop={profile?.crop}
          />
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Sua Biblioteca</Text>

        <TouchableOpacity
          onPress={handleImport}
          disabled={loading}
          style={styles.importButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.accent.primary} />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="add" size={18} color={COLORS.accent.primary} />
              <Text style={styles.importButtonText}>Adicionar</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar músicas ou artistas"
            placeholderTextColor={COLORS.text.tertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        data={FILTERS}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const selected = item.key === filterMode;
          return (
            <FilterChip
              item={item}
              selected={selected}
              onPress={() => setFilterMode(item.key)}
            />
          );
        }}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            title={query ? 'Nenhum resultado' : 'Biblioteca vazia'}
            subtitle={
              query
                ? 'Tente outro nome ou artista'
                : 'Toque em "+ Adicionar" para importar suas músicas'
            }
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
      />

      <Modal
        visible={showImportFolderPrompt}
        animationType="fade"
        transparent
        onRequestClose={dismissImportFolderPrompt}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.importFolderSheet}>
            <View style={styles.promptIcon}>
              <Ionicons name="folder-open" size={28} color={COLORS.accent.primary} />
            </View>
            <Text style={styles.promptTitle}>Organizar músicas</Text>
            <Text style={styles.promptText}>
              Deseja colocar as músicas importadas em uma pasta agora?
            </Text>

            <TouchableOpacity
              style={styles.promptAction}
              onPress={() => {
                setShowImportFolderPrompt(false);
                setShowCreateFolder(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={22} color={COLORS.text.primary} />
              <Text style={styles.promptActionText}>Criar pasta para elas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.promptAction,
                folders.length === 0 && styles.promptActionDisabled,
              ]}
              disabled={folders.length === 0}
              onPress={() => {
                setShowImportFolderPrompt(false);
                setShowSelectFolder(true);
              }}
            >
              <Ionicons
                name="folder-outline"
                size={22}
                color={folders.length === 0 ? COLORS.text.tertiary : COLORS.text.primary}
              />
              <Text
                style={[
                  styles.promptActionText,
                  folders.length === 0 && styles.promptActionTextDisabled,
                ]}
              >
                Colocar em pasta existente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promptSkip} onPress={dismissImportFolderPrompt}>
              <Text style={styles.promptSkipText}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CreateFolderModal
        visible={showCreateFolder}
        title="Pasta para músicas importadas"
        placeholder="Nome da nova pasta…"
        onClose={() => {
          setShowCreateFolder(false);
          setPendingFolderTrackIds([]);
        }}
        onCreate={handleCreateImportFolder}
      />

      <SelectFolderModal
        visible={showSelectFolder}
        title="Escolher pasta"
        showNoFolderOption={false}
        emptyTitle="Crie uma pasta primeiro para organizar estas músicas."
        onClose={() => {
          setShowSelectFolder(false);
          setPendingFolderTrackIds([]);
        }}
        onSelect={handleSelectImportFolder}
      />

      <TrackActionsModal
        visible={showTrackActions}
        track={selectedTrack}
        onClose={() => {
          setShowTrackActions(false);
          setSelectedTrack(null);
        }}
        onMove={() => {
          setShowTrackActions(false);
          setShowMoveFolder(true);
        }}
        onPlaylist={() => {
          setShowTrackActions(false);
          setShowPlaylistPicker(true);
        }}
        onRename={() => {
          setShowTrackActions(false);
          setShowRenameTrack(true);
        }}
        onDelete={() => {
          const track = selectedTrack;
          setShowTrackActions(false);
          setSelectedTrack(null);
          if (track) handleDelete(track);
        }}
      />

      <SelectFolderModal
        visible={showMoveFolder}
        title="Mover música"
        currentFolderId={selectedTrack?.folderId}
        onClose={() => {
          setShowMoveFolder(false);
          setSelectedTrack(null);
        }}
        onSelect={async (folderId) => {
          if (selectedTrack) await updateTrackFolder(selectedTrack.id, folderId);
          setShowMoveFolder(false);
          setSelectedTrack(null);
        }}
      />

      <PlaylistPickerModal
        visible={showPlaylistPicker}
        playlists={playlists}
        onClose={() => {
          setShowPlaylistPicker(false);
          setSelectedTrack(null);
        }}
        onSelect={(playlistId) => {
          if (selectedTrack) addTrackToPlaylist(playlistId, selectedTrack.id);
          setShowPlaylistPicker(false);
          setSelectedTrack(null);
        }}
      />

      <RenameTrackModal
        visible={showRenameTrack}
        track={selectedTrack}
        onClose={() => {
          setShowRenameTrack(false);
          setSelectedTrack(null);
        }}
        onSave={async (title, artist) => {
          if (selectedTrack) await updateTrack(selectedTrack.id, { title, artist });
          setShowRenameTrack(false);
          setSelectedTrack(null);
        }}
      />
    </View>
  );
};

const TrackActionsModal: React.FC<{
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onMove: () => void;
  onPlaylist: () => void;
  onRename: () => void;
  onDelete: () => void;
}> = ({ visible, track, onClose, onMove, onPlaylist, onRename, onDelete }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.bottomOverlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.bottomSheet}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {track?.title ?? 'Música'}
        </Text>
        <TouchableOpacity style={styles.sheetRow} onPress={onMove}>
          <Ionicons name="folder-outline" size={22} color={COLORS.text.primary} />
          <Text style={styles.sheetRowText}>Mover para pasta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetRow} onPress={onPlaylist}>
          <Ionicons name="musical-notes-outline" size={22} color={COLORS.text.primary} />
          <Text style={styles.sheetRowText}>Adicionar à playlist</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetRow} onPress={onRename}>
          <Ionicons name="create-outline" size={22} color={COLORS.text.primary} />
          <Text style={styles.sheetRowText}>Renomear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetRow} onPress={onDelete}>
          <Ionicons name="trash-outline" size={22} color={COLORS.semantic.error} />
          <Text style={[styles.sheetRowText, { color: COLORS.semantic.error }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const PlaylistPickerModal: React.FC<{
  visible: boolean;
  playlists: Playlist[];
  onClose: () => void;
  onSelect: (playlistId: string) => void;
}> = ({ visible, playlists, onClose, onSelect }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.bottomOverlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Adicionar à playlist</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Ionicons name="close" size={24} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>
        <RNFlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptySheetText}>Crie uma playlist primeiro.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.sheetRow} onPress={() => onSelect(item.id)}>
              <Ionicons name="musical-notes-outline" size={22} color={COLORS.accent.primary} />
              <Text style={styles.sheetRowText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  </Modal>
);

const RenameTrackModal: React.FC<{
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onSave: (title: string, artist: string) => void;
}> = ({ visible, track, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  React.useEffect(() => {
    if (visible) {
      setTitle(track?.title ?? '');
      setArtist(track?.artist ?? '');
    }
  }, [track, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.bottomOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <Text style={styles.sheetTitle}>Renomear música</Text>
          <TextInput
            style={styles.renameInput}
            placeholder="Nome da música"
            placeholderTextColor={COLORS.text.tertiary}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.renameInput}
            placeholder="Artista"
            placeholderTextColor={COLORS.text.tertiary}
            value={artist}
            onChangeText={setArtist}
          />
          <View style={styles.renameActions}>
            <TouchableOpacity style={styles.renameCancel} onPress={onClose}>
              <Text style={styles.renameCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.renameSave, !title.trim() && styles.renameSaveDisabled]}
              disabled={!title.trim()}
              onPress={() => onSave(title.trim(), artist.trim() || 'Offline')}
            >
              <Text style={styles.renameSaveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h1,
    flex: 1,
  },
  profileButton: {
    width: SIZES.avatar.md,
    height: SIZES.avatar.md,
    marginBottom: SPACING.xs,
  },
  importButton: {
    backgroundColor: COLORS.accent.muted,
    minWidth: 104,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.chip,
  },
  importButtonText: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent.primary,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  // ── Search ──
  searchRow: {
    paddingHorizontal: SPACING.screenPadding,
    marginBottom: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg.input,
    borderRadius: RADIUS.input,
    paddingHorizontal: SPACING.md,
    height: 44,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    padding: 0,
  },
  filterList: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border.default,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  filterText: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
    fontWeight: '700',
  },
  filterTextActive: {
    color: COLORS.text.inverse,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.screenPadding,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  importFolderSheet: {
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  promptIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent.muted,
    marginBottom: SPACING.md,
  },
  promptTitle: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  promptText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginBottom: SPACING.lg,
  },
  promptAction: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border.default,
    backgroundColor: COLORS.bg.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  promptActionDisabled: {
    opacity: 0.55,
  },
  promptActionText: {
    flex: 1,
    ...TYPOGRAPHY.title,
  },
  promptActionTextDisabled: {
    color: COLORS.text.tertiary,
  },
  promptSkip: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  promptSkipText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.secondary,
  },
  bottomOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  bottomSheet: {
    backgroundColor: COLORS.bg.overlay,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    padding: SPACING.lg,
    maxHeight: '78%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border.default,
  },
  sheetRowText: {
    flex: 1,
    ...TYPOGRAPHY.title,
  },
  emptySheetText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  renameInput: {
    backgroundColor: COLORS.bg.input,
    borderRadius: RADIUS.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border.default,
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    marginBottom: SPACING.sm,
  },
  renameActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  renameCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  renameCancelText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.secondary,
  },
  renameSave: {
    flex: 1.4,
    alignItems: 'center',
    backgroundColor: COLORS.accent.primary,
    borderRadius: RADIUS.button,
    paddingVertical: SPACING.md,
  },
  renameSaveDisabled: {
    opacity: 0.45,
  },
  renameSaveText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.inverse,
    fontWeight: '700',
  },
});
