import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  query,
  orderBy,
} from '../services/firebase';
import { auth, db } from '../services/firebase';

export interface Playlist {
  id:        string;
  name:      string;
  trackIds:  string[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistsState {
  playlists: Playlist[];
  hydrated:  boolean;

  hydrate:         () => Promise<void>;
  createPlaylist:  (name: string) => Playlist;
  renamePlaylist:  (id: string, name: string) => void;
  deletePlaylist:  (id: string) => void;
  addTrackToPlaylist:      (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromAllPlaylists: (trackId: string) => void;
  reorderTracks:           (playlistId: string, from: number, to: number) => void;
  isTrackInPlaylist:       (playlistId: string, trackId: string) => boolean;
}

const STORAGE_KEY = '@sondlize:playlists';

const getStorageKey = () => {
  const user = auth.currentUser;
  return user ? `${STORAGE_KEY}:${user.uid}` : STORAGE_KEY;
};

const persist = async (playlists: Playlist[]) => {
  try {
    await AsyncStorage.setItem(getStorageKey(), JSON.stringify(playlists));
  } catch (e) {
    console.warn('[PlaylistsStore] persist error', e);
  }
};

const syncToFirestore = async (playlists: Playlist[]) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    for (const playlist of playlists) {
      const ref = doc(db, 'users', user.uid, 'playlists', playlist.id);
      await setDoc(ref, playlist);
    }
  } catch (e) {
    console.warn('[PlaylistsStore] firestore sync error', e);
  }
};

const uid = () =>
  `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const reorder = <T>(arr: T[], from: number, to: number): T[] => {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
};

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  playlists: [],
  hydrated:  false,

  hydrate: async () => {
    try {
      const user = auth.currentUser;
      let local: Playlist[] = [];
      try {
        const raw = await AsyncStorage.getItem(getStorageKey());
        local = raw ? JSON.parse(raw) : [];
      } catch {
        local = [];
      }

      if (user) {
        const q = query(
          collection(db, 'users', user.uid, 'playlists'),
          orderBy('createdAt', 'asc')
        );
        const snapshot = await getDocs(q);
        const playlists: Playlist[] = [];
        snapshot.forEach((doc) => {
          playlists.push(doc.data() as Playlist);
        });

        if (playlists.length === 0 && local.length > 0) {
          set({ playlists: local, hydrated: true });
          return;
        }

        set({ playlists, hydrated: true });
        await persist(playlists);
      } else {
        set({ playlists: local, hydrated: true });
      }
    } catch {
      try {
        const raw = await AsyncStorage.getItem(getStorageKey());
        if (raw) {
          const parsed: Playlist[] = JSON.parse(raw);
          set({ playlists: parsed, hydrated: true });
        } else {
          set({ hydrated: true });
        }
      } catch {
        set({ hydrated: true });
      }
    }
  },

  createPlaylist: (name: string) => {
    const now      = Date.now();
    const playlist: Playlist = {
      id:        uid(),
      name:      name.trim(),
      trackIds:  [],
      createdAt: now,
      updatedAt: now,
    };
    const next = [playlist, ...get().playlists];
    set({ playlists: next });
    persist(next);
    syncToFirestore(next);
    return playlist;
  },

  renamePlaylist: (id, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const next = get().playlists.map((p) =>
      p.id === id ? { ...p, name: trimmedName, updatedAt: Date.now() } : p,
    );
    set({ playlists: next });
    persist(next);
    syncToFirestore(next);
  },

  deletePlaylist: (id) => {
    const next = get().playlists.filter((p) => p.id !== id);
    set({ playlists: next });
    persist(next);

    const user = auth.currentUser;
    if (user) {
      const ref = doc(db, 'users', user.uid, 'playlists', id);
      deleteDoc(ref).catch((e) => console.warn('[PlaylistsStore] delete error', e));
    }
  },

  addTrackToPlaylist: (playlistId, trackId) => {
    const next = get().playlists.map((p) => {
      if (p.id !== playlistId) return p;
      if (p.trackIds.includes(trackId)) return p;
      return {
        ...p,
        trackIds:  [...p.trackIds, trackId],
        updatedAt: Date.now(),
      };
    });
    set({ playlists: next });
    persist(next);
    syncToFirestore(next);
  },

  removeTrackFromPlaylist: (playlistId, trackId) => {
    const next = get().playlists.map((p) =>
      p.id !== playlistId
        ? p
        : { ...p, trackIds: p.trackIds.filter((id) => id !== trackId), updatedAt: Date.now() },
    );
    set({ playlists: next });
    persist(next);
    syncToFirestore(next);
  },

  removeTrackFromAllPlaylists: (trackId) => {
    const next = get().playlists.map((p) => {
      if (!p.trackIds.includes(trackId)) return p;
      return {
        ...p,
        trackIds: p.trackIds.filter((id) => id !== trackId),
        updatedAt: Date.now(),
      };
    });
    set({ playlists: next });
    persist(next);
    syncToFirestore(next);
  },

  reorderTracks: (playlistId, from, to) => {
    const next = get().playlists.map((p) =>
      p.id !== playlistId
        ? p
        : { ...p, trackIds: reorder(p.trackIds, from, to), updatedAt: Date.now() },
    );
    set({ playlists: next });
    persist(next);
    syncToFirestore(next);
  },

  isTrackInPlaylist: (playlistId, trackId) => {
    const p = get().playlists.find((pl) => pl.id === playlistId);
    return p ? p.trackIds.includes(trackId) : false;
  },
}));
