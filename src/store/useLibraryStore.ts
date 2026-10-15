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
import { ref, uploadBytes, deleteObject } from '../services/firebase';
import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  query,
  orderBy,
  deleteField,
} from '../services/firebase';
import { Track } from '../core/entities';
import { extractMetadata } from '../utils/metadataParser';
import { auth, db, storage } from '../services/firebase';
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
  updateTrack: (trackId: string, updates: Partial<Pick<Track, 'title' | 'artist' | 'folderId' | 'folderSortOrder' | 'lastPlayedAt'>>) => Promise<void>;
  markTrackPlayed: (trackId: string) => Promise<void>;
  updateTrackFolder: (trackId: string, folderId: string | undefined) => Promise<void>;
  reorderFolderTracks: (folderId: string, from: number, to: number) => Promise<void>;
  rescanMusic: () => Promise<number>;
}

const STORAGE_KEY = '@sondlize:library';

const getStorageKey = () => {
  const user = auth.currentUser;
  return user ? `${STORAGE_KEY}:${user.uid}` : STORAGE_KEY;
};

const persistTracks = async (tracks: Track[]) => {
  await AsyncStorage.setItem(getStorageKey(), JSON.stringify(tracks));
};

const withoutUndefined = <T extends object>(value: T) =>
  Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined),
  ) as Partial<T>;

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
      // Lê o cache local antes de qualquer sync, para nunca perdê-lo
      // para um resultado vindo da nuvem vazio.
      let local: Track[] = [];
      try {
        const raw = await AsyncStorage.getItem(getStorageKey());
        local = raw ? JSON.parse(raw) : [];
      } catch {
        local = [];
      }

      const user = auth.currentUser;

      if (user) {
        const q = query(
          collection(db, 'users', user.uid, 'tracks'),
          orderBy('createdAt', 'asc')
        );
        const snapshot = await getDocs(q);
        const remote: Track[] = [];
        snapshot.forEach((doc) => {
          remote.push(doc.data() as Track);
        });

        // A nuvem pode conter apenas parte das faixas quando um upload em
        // segundo plano falha. O cache local é a fonte de recuperação dessas
        // faixas; dados remotos com o mesmo ID continuam sendo preferidos.
        const remoteIds = new Set(remote.map((track) => track.id));
        const merged = [
          ...remote,
          ...local.filter((track) => !remoteIds.has(track.id)),
        ].sort((a, b) => a.createdAt - b.createdAt);

        set({ tracks: merged, isLoaded: true });
        await persistTracks(merged);
      } else {
        set({ tracks: local, isLoaded: true });
      }
    } catch {
      try {
        const raw = await AsyncStorage.getItem(getStorageKey());
        const tracks: Track[] = raw ? JSON.parse(raw) : [];
        set({ tracks, isLoaded: true });
      } catch {
        set({ isLoaded: true });
      }
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
      const user = auth.currentUser;
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

      // Se houver um usuário autenticado, faz o upload em segundo plano para o Firebase
      if (user) {
        // Dispara a promessa sem dar o 'await' para não travar a UI
        (async () => {
          console.log('[Background Upload] Iniciando upload em segundo plano de', newTracks.length, 'músicas');
          const failed: string[] = [];
          for (let i = 0; i < assetsToImport.length; i++) {
            const track = newTracks[i];
            try {
              console.log(`[Background Upload] Enviando para o Firebase: "${track.title}" (${track.file})`);
              const response = await fetch(track.file);
              const blob = await response.blob();
              // Usa o mesmo nome do arquivo local para que o deleteTrack()
              // consiga apagar o arquivo do Storage com track.file.split('/').pop().
              const safeName = track.file.split('/').pop() || '';
              const storageRef = ref(storage, `users/${user.uid}/tracks/${safeName}`);
              await uploadBytes(storageRef, blob);

              const trackRef = doc(db, 'users', user.uid, 'tracks', track.id);
              await setDoc(trackRef, withoutUndefined(track));
              console.log(`[Background Upload] Sucesso ao enviar "${track.title}" para o Firebase`);
            } catch (e) {
              failed.push(track.title);
              console.warn(`[Background Upload] Falha no upload de "${track.title}":`, e);
            }
          }

          if (failed.length > 0) {
            Alert.alert(
              'Sincronização pendente',
              `${failed.length} música${failed.length === 1 ? '' : 's'} ficou${failed.length === 1 ? '' : 'ram'} salva${failed.length === 1 ? '' : 's'} no aparelho, mas não subiu${failed.length === 1 ? '' : 'ram'} para a nuvem agora.`,
            );
          }
        })();
      }

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

      const user = auth.currentUser;
      if (user) {
        try {
          const safeName = track.file.split('/').pop() || '';
          const storageRef = ref(storage, `users/${user.uid}/tracks/${safeName}`);
          await deleteObject(storageRef);

          const trackRef = doc(db, 'users', user.uid, 'tracks', track.id);
          await deleteDoc(trackRef);
        } catch (e) {
          console.warn('Firebase delete failed:', e);
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

    const user = auth.currentUser;
    if (user) {
      try {
        const trackRef = doc(db, 'users', user.uid, 'tracks', trackId);
        await setDoc(trackRef, withoutUndefined(updates), { merge: true });
      } catch (e) {
        console.warn('Firestore track update failed:', e);
      }
    }
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

    const user = auth.currentUser;
    if (user) {
      try {
        const trackRef = doc(db, 'users', user.uid, 'tracks', trackId);
        await setDoc(
          trackRef,
          folderId
            ? { folderId, folderSortOrder: nextOrder }
            : { folderId: deleteField(), folderSortOrder: deleteField() },
          { merge: true },
        );
      } catch (e) {
        console.warn('Firestore update failed:', e);
      }
    }
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

    const user = auth.currentUser;
    if (user) {
      try {
        await Promise.all(
          reordered.map((track, index) =>
            setDoc(
              doc(db, 'users', user.uid, 'tracks', track.id),
              { folderSortOrder: index },
              { merge: true },
            ),
          ),
        );
      } catch (e) {
        console.warn('Firestore reorder tracks failed:', e);
      }
    }
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

      // Sobe as músicas recuperadas para o Firebase em segundo plano,
      // igual ao fluxo de importação.
      const user = auth.currentUser;
      if (user) {
        (async () => {
          const failed: string[] = [];
          for (const track of recovered) {
            try {
              const response = await fetch(track.file);
              const blob = await response.blob();
              const safeName = track.file.split('/').pop() || '';
              const storageRef = ref(storage, `users/${user.uid}/tracks/${safeName}`);
              await uploadBytes(storageRef, blob);

              const trackRef = doc(db, 'users', user.uid, 'tracks', track.id);
              await setDoc(trackRef, withoutUndefined(track));
            } catch (e) {
              failed.push(track.title);
              console.warn(`[Rescan] Falha no upload de "${track.title}":`, e);
            }
          }

          if (failed.length > 0) {
            Alert.alert(
              'Sincronização pendente',
              `${failed.length} música${failed.length === 1 ? '' : 's'} recuperada${failed.length === 1 ? '' : 's'} ficou${failed.length === 1 ? '' : 'ram'} salva${failed.length === 1 ? '' : 's'} no aparelho, mas não subiu${failed.length === 1 ? '' : 'ram'} para a nuvem agora.`,
            );
          }
        })();
      }

      return recovered.length;
    } catch (e: any) {
      console.error('Rescan error:', e);
      set({ error: e?.message ?? 'Erro ao recuperar músicas.', isLoading: false });
      return 0;
    }
  },
}));
