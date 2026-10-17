import { create } from 'zustand';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  documentDirectory,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { Track } from '../core/entities';
import { extractMetadata } from '../utils/metadataParser';
import { usePlayerStore } from './usePlayerStore';
import { usePlaylistsStore } from './usePlaylistsStore';

interface LibraryState {
  tracks: Track[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadTracks: () => Promise<void>;
  importMusic: () => Promise<Track[]>;
  deleteTrack: (id: string) => Promise<void>;
  updateTrack: (trackId: string, updates: Partial<Pick<Track, 'title' | 'artist' | 'folderId' | 'folderSortOrder' | 'lastPlayedAt' | 'lyrics'>>) => Promise<void>;
  markTrackPlayed: (trackId: string) => Promise<void>;
  updateTrackFolder: (trackId: string, folderId: string | undefined) => Promise<void>;
  reorderFolderTracks: (folderId: string, from: number, to: number) => Promise<void>;
  rescanMusic: () => Promise<number>;
}

const STORAGE_KEY = '@sondlize:library';

const getStorageKey = () => STORAGE_KEY;

const persistTracks = async (tracks: Track[]) => {
  await AsyncStorage.setItem(getStorageKey(), JSON.stringify(tracks));
};

const getSafeLocalName = (name?: string) =>
  name ? name.replace(/[^a-zA-Z0-9.-]/g, '_') : `track_${Date.now()}.mp3`;

const getUniqueFileName = (safeName: string, usedNames: Set<string>) => {
  let candidate = safeName;
  let count = 1;
  const dotIndex = safeName.lastIndexOf('.');
  const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const ext = dotIndex > 0 ? safeName.slice(dotIndex) : '';

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${count}${ext}`;
    count += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
};

const confirmDuplicateImport = (count: number) =>
  new Promise<'skip' | 'import' | 'cancel'>((resolve) => {
    Alert.alert(
      'Músicas duplicadas',
      `${count} música${count === 1 ? '' : 's'} já parece${count === 1 ? '' : 'm'} estar na biblioteca.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Ignorar duplicadas', onPress: () => resolve('skip') },
        { text: 'Importar mesmo', onPress: () => resolve('import') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    );
  });

const getTrackDuration = async (uri: string): Promise<number> => {
  try {
    const { sound, status } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false }
    );
    const duration = status.isLoaded && status.durationMillis ? status.durationMillis : 0;
    await sound.unloadAsync();
    return duration;
  } catch {
    return 0;
  }
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  loadTracks: async () => {
    try {
      // Modo offline: o cache local é a fonte única de verdade.
      const raw = await AsyncStorage.getItem(getStorageKey());
      const tracks: Track[] = raw ? JSON.parse(raw) : [];
      set({ tracks, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  importMusic: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp3', 'audio/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) {
        set({ isLoading: false });
        return [];
      }

      const newTracks: Track[] = [];
      const permDir = `${documentDirectory}SondLizeMusic/`;
      const existingNames = new Set(
        get().tracks
          .map((track) => track.file.split('/').pop()?.toLowerCase())
          .filter((name): name is string => !!name),
      );
      const duplicateAssets = result.assets.filter((file) =>
        existingNames.has(getSafeLocalName(file.name).toLowerCase()),
      );
      const usedNames = new Set(existingNames);
      let assetsToImport = result.assets;

      if (duplicateAssets.length > 0) {
        const choice = await confirmDuplicateImport(duplicateAssets.length);
        if (choice === 'cancel') {
          set({ isLoading: false });
          return [];
        }
        if (choice === 'skip') {
          assetsToImport = result.assets.filter(
            (file) => !existingNames.has(getSafeLocalName(file.name).toLowerCase()),
          );
        }
      }

      for (const file of assetsToImport) {
        // The file is already copied to cache by DocumentPicker (copyToCacheDirectory: true)
        // We copy it to a permanent directory
        await makeDirectoryAsync(permDir, { intermediates: true });
        
        // Generate a safe file name
        const safeNameForLocal = getUniqueFileName(getSafeLocalName(file.name), usedNames);
        const destPath = `${permDir}${safeNameForLocal}`;
        await copyAsync({ from: file.uri, to: destPath });
        
        const fileUri = destPath;

        const metadata = await extractMetadata(fileUri);
        const duration = await getTrackDuration(fileUri);

        const title = metadata.title || (file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Desconhecido');
        const artist = metadata.artist || 'Offline';

        const track: Track = {
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          title,
          artist,
          duration,
          file: fileUri,
          folderId: undefined,
          folderSortOrder: undefined,
          artwork: metadata.artwork,
          createdAt: Date.now(),
        };

        newTracks.push(track);
      }

      const updatedTracks = [...get().tracks, ...newTracks];
      set({ tracks: updatedTracks, isLoading: false });

      await persistTracks(updatedTracks);

      return newTracks;
    } catch (e: any) {
      console.error('Import error:', e);
      set({ error: e?.message ?? 'Erro ao importar músicas.', isLoading: false });
      return [];
    }
  },

  deleteTrack: async (id: string) => {
    const track = get().tracks.find((t) => t.id === id);
    if (!track) return;

    try {
      // Remove a referência do player antes de apagar o arquivo físico. Isso
      // também cobre chamadas diretas ao store, sem depender da tela pausar.
      usePlayerStore.getState().removeTrackFromQueue(id);

      // Delete local file from permanent storage
      if (track.file && documentDirectory && track.file.startsWith(documentDirectory)) {
        try {
          await deleteAsync(track.file, { idempotent: true });
        } catch (e) {
          console.warn('Local file delete failed:', e);
        }
      }

      const updatedTracks = get().tracks.filter((t) => t.id !== id);
      set({ tracks: updatedTracks });
      usePlaylistsStore.getState().removeTrackFromAllPlaylists(id);
      await persistTracks(updatedTracks);
    } catch (e) {
      console.warn('Failed to delete track:', e);
    }
  },

  updateTrack: async (trackId, updates) => {
    const updatedTracks = get().tracks.map((t) =>
      t.id === trackId ? { ...t, ...updates } : t,
    );
    set({ tracks: updatedTracks });
    await persistTracks(updatedTracks);
  },

  markTrackPlayed: async (trackId) => {
    await get().updateTrack(trackId, { lastPlayedAt: Date.now() });
  },

  updateTrackFolder: async (trackId: string, folderId: string | undefined) => {
    const folderTracks = get().tracks.filter((t) => t.folderId === folderId);
    const nextOrder = folderId ? folderTracks.length : undefined;
    const updatedTracks = get().tracks.map(t =>
      t.id === trackId ? { ...t, folderId, folderSortOrder: nextOrder } : t
    );
    set({ tracks: updatedTracks });
    await persistTracks(updatedTracks);
  },

  reorderFolderTracks: async (folderId, from, to) => {
    const current = get().tracks;
    const folderTracks = current
      .filter((t) => t.folderId === folderId)
      .sort((a, b) => (a.folderSortOrder ?? a.createdAt) - (b.folderSortOrder ?? b.createdAt));

    if (from === to || from < 0 || to < 0 || from >= folderTracks.length || to >= folderTracks.length) {
      return;
    }

    const reordered = [...folderTracks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const orderById = new Map(reordered.map((track, index) => [track.id, index]));
    const updatedTracks = current.map((track) =>
      track.folderId === folderId
        ? { ...track, folderSortOrder: orderById.get(track.id) ?? track.folderSortOrder }
        : track,
    );

    set({ tracks: updatedTracks });
    await persistTracks(updatedTracks);
  },

  rescanMusic: async () => {
    set({ isLoading: true, error: null });

    try {
      const permDir = `${documentDirectory}SondLizeMusic/`;
      let files: string[] = [];
      try {
        files = await readDirectoryAsync(permDir);
      } catch {
        // Pasta não existe ainda — nada a recuperar.
        files = [];
      }

      const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'opus', 'mp4'];
      const existingPaths = new Set(get().tracks.map((t) => t.file));
      const recovered: Track[] = [];

      for (const name of files) {
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        if (!AUDIO_EXTS.includes(ext)) continue;

        const fileUri = `${permDir}${name}`;
        if (existingPaths.has(fileUri)) continue; // já está na biblioteca

        const metadata = await extractMetadata(fileUri);
        const duration = await getTrackDuration(fileUri);

        const title = metadata.title || name.replace(/\.[^/.]+$/, '');
        const artist = metadata.artist || 'Offline';

        recovered.push({
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          title,
          artist,
          duration,
          file: fileUri,
          folderId: undefined,
          artwork: metadata.artwork,
          createdAt: Date.now(),
        });
      }

      set({ isLoading: false });

      if (recovered.length === 0) return 0;

      const updatedTracks = [...get().tracks, ...recovered];
      set({ tracks: updatedTracks });
      await persistTracks(updatedTracks);

      return recovered.length;
    } catch (e: any) {
      console.error('Rescan error:', e);
      set({ error: e?.message ?? 'Erro ao recuperar músicas.', isLoading: false });
      return 0;
    }
  },
}));
