import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Folder } from '../core/entities';

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

const getStorageKey = () => STORAGE_KEY;

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
      // Modo offline: o cache local é a fonte única de verdade.
      const raw = await AsyncStorage.getItem(getStorageKey());
      const folders: Folder[] = raw ? JSON.parse(raw) : [];
      set({ folders: sortFolders(folders), isLoaded: true });
    } catch {
      set({ isLoaded: true });
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
  },

  updateFolder: async (id, updates) => {
    const folders = get().folders.map((f) =>
      f.id === id ? { ...f, ...updates } : f,
    );
    set({ folders });
    await persist(folders);
  },

  deleteFolder: async (id) => {
    const folders = get().folders.filter((f) => f.id !== id);
    set({ folders });
    await persist(folders);
  },
}));
