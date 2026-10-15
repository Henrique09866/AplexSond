import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AvatarCrop } from '../core/entities';

export interface UserProfile {
  displayName?: string;
  photoURL?: string;
  avatarPath?: string;
  crop?: AvatarCrop;
}

interface AuthState {
  user: null;
  profile: UserProfile | null;
  isLoading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  listen: () => () => void;
  loadProfile: () => Promise<void>;
  saveProfile: (data: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (uri: string) => Promise<void>;
}

const PROFILE_KEY = '@sondlize:profile:local';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  initialized: true,

  listen: () => {
    // Modo offline/local: n drawers contas. Apenas marcamos o app como pronto.
    set({ user: null, isLoading: false, initialized: true });
    get().loadProfile().catch(() => {});
    return () => {};
  },

  loadProfile: async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (raw) set({ profile: JSON.parse(raw) as UserProfile });
    } catch {
      // Ignora falhas de cache local.
    }
  },

  signIn: async () => {
    // Sem autenticação em nuvem: modo local apenas.
  },

  signUp: async () => {
    // Sem autenticação em nuvem: modo local apenas.
  },

  signOut: async () => {
    // Sem contas para remover.
  },

  saveProfile: async (data) => {
    const nextProfile = { ...(get().profile ?? {}), ...data };
    set({ profile: nextProfile });
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    } catch {
      // Mantém o estado em memória mesmo se a persistência falhar.
    }
  },

  uploadAvatar: async (uri) => {
    const profile = get().profile ?? {};
    const previousAvatarPath = profile.avatarPath;
    const dir = `${FileSystem.documentDirectory}SondLizeAvatars/`;

    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const extMatch = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const safeExt = /^(jpg|jpeg|png|webp|heic|heif)$/.test(ext) ? ext : 'jpg';
    const dest = `${dir}avatar_${Date.now()}.${safeExt}`;

    await FileSystem.copyAsync({ from: uri, to: dest });

    const nextProfile: UserProfile = {
      ...profile,
      photoURL: dest,
      avatarPath: dest,
    };

    set({ profile: nextProfile });
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    } catch {
      // Mantém o estado em memória.
    }

    if (previousAvatarPath && previousAvatarPath !== dest) {
      FileSystem.deleteAsync(previousAvatarPath, { idempotent: true }).catch(() => {});
    }
  },
}));
