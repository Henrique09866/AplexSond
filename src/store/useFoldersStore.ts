import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  deleteField,
} from '../services/firebase';
import { Folder } from '../core/entities';
import { auth, db } from '../services/firebase';

interface FoldersState {
  folders: Folder[];
  isLoaded: boolean;
  load: () => Promise<void>;
  createFolder: (name: string, color: string) => Promise<Folder>;
  updateFolder: (
    id: string,
    updates: Partial<Pick<Folder, 'name' | 'color' | 'artwork'>>,
  ) => Promise<void>;
  reorderFolders: (from: number, to: number) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

const STORAGE_KEY = '@sondlize:folders';

const getStorageKey = () => {
  const user = auth.currentUser;
  return user ? `${STORAGE_KEY}:${user.uid}` : STORAGE_KEY;
};

const persist = async (folders: Folder[]) => {
  await AsyncStorage.setItem(getStorageKey(), JSON.stringify(folders));
};

const sortFolders = (folders: Folder[]) =>
  [...folders].sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt));

const withSortOrder = (folders: Folder[]) =>
  folders.map((folder, index) => ({
    ...folder,
    sortOrder: index,
  }));

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  isLoaded: false,

  load: async () => {
    try {
      // Lê o cache local antes de qualquer sync, para nunca perdê-lo
      // para um resultado vindo da nuvem vazio.
      let local: Folder[] = [];
      try {
        const raw = await AsyncStorage.getItem(getStorageKey());
        local = raw ? JSON.parse(raw) : [];
      } catch {
        local = [];
      }

      const user = auth.currentUser;

      if (user) {
        const snapshot = await getDocs(collection(db, 'users', user.uid, 'folders'));
        const remote: Folder[] = [];
        snapshot.forEach((doc) => {
          remote.push(doc.data() as Folder);
        });

        // FIX: bug de perda de dados — se o Firebase voltar vazio mas o aparelho
        // tiver pastas locais, NÃO sobrescreve o cache local com a lista vazia.
        if (remote.length === 0 && local.length > 0) {
          console.warn('[useFoldersStore] Firebase vazio; mantendo pastas locais.');
          set({ folders: sortFolders(local), isLoaded: true });
          return;
        }

        const sortedRemote = sortFolders(remote);
        set({ folders: sortedRemote, isLoaded: true });
        await persist(sortedRemote);
      } else {
        set({ folders: sortFolders(local), isLoaded: true });
      }
    } catch {
      try {
        const raw = await AsyncStorage.getItem(getStorageKey());
        const folders: Folder[] = raw ? JSON.parse(raw) : [];
        set({ folders: sortFolders(folders), isLoaded: true });
      } catch {
        set({ isLoaded: true });
      }
    }
  },

  createFolder: async (name, color) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      color,
      createdAt: Date.now(),
      sortOrder: get().folders.length,
    };
    const folders = [...get().folders, newFolder];
    set({ folders });
    await persist(folders);

    const user = auth.currentUser;
    if (user) {
      try {
        const folderRef = doc(db, 'users', user.uid, 'folders', newFolder.id);
        await setDoc(folderRef, newFolder);
      } catch (e) {
        console.warn('Firestore save failed:', e);
      }
    }

    return newFolder;
  },

  reorderFolders: async (from, to) => {
    const current = get().folders;
    if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
      return;
    }

    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ordered = withSortOrder(next);

    set({ folders: ordered });
    await persist(ordered);

    const user = auth.currentUser;
    if (user) {
      try {
        await Promise.all(
          ordered.map((folder) =>
            setDoc(
              doc(db, 'users', user.uid, 'folders', folder.id),
              { sortOrder: folder.sortOrder },
              { merge: true },
            ),
          ),
        );
      } catch (e) {
        console.warn('Firestore reorder failed:', e);
      }
    }
  },

  updateFolder: async (id, updates) => {
    const folders = get().folders.map((f) =>
      f.id === id ? { ...f, ...updates } : f,
    );
    set({ folders });
    await persist(folders);

    const user = auth.currentUser;
    if (user) {
      try {
        const folderRef = doc(db, 'users', user.uid, 'folders', id);
        const payload: Record<string, unknown> = { ...updates };
        if ('artwork' in updates && updates.artwork === undefined) {
          payload.artwork = deleteField();
        }
        await setDoc(folderRef, payload, { merge: true });
      } catch (e) {
        console.warn('Firestore update failed:', e);
      }
    }
  },

  deleteFolder: async (id) => {
    const folders = get().folders.filter((f) => f.id !== id);
    set({ folders });
    await persist(folders);

    const user = auth.currentUser;
    if (user) {
      try {
        const folderRef = doc(db, 'users', user.uid, 'folders', id);
        await deleteDoc(folderRef);
      } catch (e) {
        console.warn('Firestore delete failed:', e);
      }
    }
  },
}));
