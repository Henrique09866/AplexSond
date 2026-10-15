import { create } from 'zustand';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { Event, PlaybackState } from '@rntp/player';
import { doc, getDoc, setDoc } from '../services/firebase';
import {
  setupTrackPlayer,
  toMediaItem,
  toNativeRepeatMode,
} from '../core/trackPlayerServices';
import { Track } from '../core/entities';
import { auth, db } from '../services/firebase';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  // Queue
  queue: Track[];
  originalQueue: Track[];
  currentIndex: number;

  // Playback
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number; // in seconds
  duration: number; // in seconds

  // Modes
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;

  // Sleep Timer
  sleepTimerEnd: number | null;
  setSleepTimer: (minutes: number | null) => void;

  // Listening stats
  listenedSeconds: number;
  addListenedSeconds: (seconds: number) => void;
  loadListenedSeconds: () => Promise<void>;
  resetListenedSeconds: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  syncPreferences: () => Promise<void>;

  // Equalizer
  eqPreset: string;
  eqBands: number[]; // 5 bands
  setEqPreset: (preset: string, bands?: number[]) => void;
  setEqBand: (index: number, value: number) => void;

  // Actions
  initListeners: () => Promise<void>;
  playQueue: (tracks: Track[], startIndex: number) => Promise<void>;
  playQueueShuffled: (tracks: Track[]) => Promise<void>;
  skipNext: () => void;
  skipPrev: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  removeTrackFromQueue: (trackId: string) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

let listenersBound = false;

const LISTENED_KEY = '@sondlize:listenedSeconds';
const PLAYER_PREFS_KEY = '@sondlize:playerPrefs';
const MAX_TICK_DELTA = 120; // segundos por tick (evita contagens absurdas)
const DEFAULT_EQ_BANDS = [0, 0, 0, 0, 0];
let lastPlaybackTick = Date.now();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let remotePersistTimer: ReturnType<typeof setTimeout> | null = null;

type PlayerPrefs = {
  listenedSeconds?: number;
  shuffleEnabled?: boolean;
  eqPreset?: string;
  eqBands?: number[];
};

const getScopedStorageKey = (key: string, userId = auth.currentUser?.uid) =>
  `${key}:${userId ?? 'anonymous'}`;

const getPlayerSettingsRef = (userId = auth.currentUser?.uid) => {
  return userId ? doc(db, 'users', userId, 'settings', 'player') : null;
};

const persistPlayerPrefsLocal = async (prefs: PlayerPrefs, userId?: string) => {
  await AsyncStorage.setItem(
    getScopedStorageKey(PLAYER_PREFS_KEY, userId),
    JSON.stringify(prefs),
  );
};

export const usePlayerStore = create<PlayerState>((set, get) => {
  const findTrackByMediaId = (mediaId: string | null | undefined): Track | null =>
    get().queue.find((t) => t.id === mediaId) ?? null;

  const syncFromPlayer = () => {
    try {
      const progress = TrackPlayer.getProgress();
      const playing = TrackPlayer.isPlaying();
      const state = TrackPlayer.getPlaybackState();
      const index = TrackPlayer.getActiveMediaItemIndex();
      const active = TrackPlayer.getActiveMediaItem();

      set({
        isPlaying: playing,
        isLoading: state === PlaybackState.Buffering,
        currentIndex: index ?? get().currentIndex,
        currentTrack: active?.mediaId
          ? findTrackByMediaId(active.mediaId)
          : get().currentTrack,
        position: progress?.position ?? 0,
        duration: progress?.duration ?? get().duration,
      });

      const timer = TrackPlayer.getSleepTimer();
      if (timer && timer.type === 'time') {
        set({ sleepTimerEnd: Date.now() + timer.remainingSeconds * 1000 });
      } else if (!timer) {
        set({ sleepTimerEnd: null });
      }
    } catch (e) {
      console.warn('[usePlayerStore] Falha ao sincronizar estado do player:', e);
    }
  };

  const bindListeners = () => {
    if (listenersBound) return;
    listenersBound = true;

    TrackPlayer.addEventListener(Event.MediaItemTransition, ({ item, index }) => {
      set({
        currentIndex: index,
        currentTrack: item?.mediaId ? findTrackByMediaId(item.mediaId) : null,
        position: 0,
      });
    });

    TrackPlayer.addEventListener(Event.IsPlayingChanged, ({ playing }) => {
      set({ isPlaying: playing });
      lastPlaybackTick = Date.now();
      if (!playing) get().addListenedSeconds(0); // força persistência pendente
    });

    TrackPlayer.addEventListener(Event.PlaybackStateChanged, ({ state }) => {
      set({ isLoading: state === PlaybackState.Buffering });
      if (state === PlaybackState.Ended) {
        set({ isPlaying: false });
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }) => {
      set({ position, duration });

      if (get().isPlaying) {
        const now = Date.now();
        const delta = (now - lastPlaybackTick) / 1000;
        lastPlaybackTick = now;
        if (delta > 0 && delta < MAX_TICK_DELTA) {
          get().addListenedSeconds(delta);
        }
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackError, ({ code, message }) => {
      console.warn(`[usePlayerStore] Erro de playback [${code}]:`, message);
      set({ isLoading: false });
    });

    TrackPlayer.addEventListener(Event.SleepTimerTriggered, () => {
      set({ sleepTimerEnd: null });
    });

    // Re-sincroniza o estado quando o app volta para o foreground,
    // pois os controles da notificação podem ter mudado o player em background.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncFromPlayer();
      }
    });

    return () => {
      appStateSub.remove();
      if (persistTimer) clearTimeout(persistTimer);
      listenersBound = false;
    };
  };

  return {
    queue: [],
    originalQueue: [],
    currentIndex: 0,
    currentTrack: null,
    isPlaying: false,
    isLoading: false,
    position: 0,
    duration: 0,
    shuffleEnabled: false,
    repeatMode: 'off',
    sleepTimerEnd: null,
    eqPreset: 'Flat',
    eqBands: DEFAULT_EQ_BANDS,
    listenedSeconds: 0,

    initListeners: async () => {
      await get().loadPreferences();
      await setupTrackPlayer();
      bindListeners();
      syncFromPlayer();
    },

    playQueue: async (tracks, startIndex) => {
      const { shuffleEnabled, repeatMode } = get();
      const initialTrack = tracks[startIndex] ?? null;

      set({
        originalQueue: tracks,
        queue: tracks,
        currentIndex: startIndex,
        currentTrack: initialTrack,
        position: 0,
        duration: 0,
        isPlaying: false,
        isLoading: true,
      });

      if (!initialTrack) {
        set({ isLoading: false });
        return;
      }

      await setupTrackPlayer();
      TrackPlayer.setMediaItems(tracks.map(toMediaItem), startIndex);
      TrackPlayer.setRepeatMode(toNativeRepeatMode(repeatMode));
      TrackPlayer.setShuffleEnabled(shuffleEnabled);
      TrackPlayer.play();
    },

    playQueueShuffled: async (tracks) => {
      if (!tracks.length) return;

      // Embaralha a fila em JS e toca na ordem embaralhada,
      // evitando que o shuffle nativo embaralhe de novo por cima.
      const shuffled = [...tracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      set({ shuffleEnabled: false });
      await get().playQueue(shuffled, 0);
    },

    skipNext: () => {
      TrackPlayer.skipToNext();
    },

    skipPrev: () => {
      // Spotify behavior: se a música tocou por mais de 3s, volta ao início;
      // caso contrário, vai para a anterior.
      if (get().position > 3) {
        TrackPlayer.seekTo(0);
      } else {
        TrackPlayer.skipToPrevious();
      }
    },

    play: () => {
      TrackPlayer.play();
    },

    pause: () => {
      TrackPlayer.pause();
    },

    seekTo: (seconds) => {
      TrackPlayer.seekTo(seconds);
    },

    removeTrackFromQueue: (trackId) => {
      const { queue, originalQueue, currentTrack, isPlaying } = get();
      if (!queue.some((track) => track.id === trackId) && currentTrack?.id !== trackId) return;

      // A faixa que está sendo reproduzida não pode continuar referenciada
      // pelo mini-player depois de ser removida da biblioteca.
      if (currentTrack?.id === trackId) {
        try {
          TrackPlayer.stop();
          TrackPlayer.clear();
          TrackPlayer.cancelSleepTimer();
        } catch (e) {
          console.warn('[usePlayerStore] Falha ao limpar a fila:', e);
        }
        set({
          queue: [],
          originalQueue: [],
          currentIndex: 0,
          currentTrack: null,
          isPlaying: false,
          isLoading: false,
          position: 0,
          duration: 0,
          sleepTimerEnd: null,
        });
        return;
      }

      const nextQueue = queue.filter((track) => track.id !== trackId);
      const nextOriginalQueue = originalQueue.filter((track) => track.id !== trackId);
      const currentQueueIndex = currentTrack
        ? nextQueue.findIndex((track) => track.id === currentTrack.id)
        : -1;
      const nextIndex = Math.min(
        currentQueueIndex >= 0 ? currentQueueIndex : get().currentIndex,
        Math.max(0, nextQueue.length - 1),
      );
      set({
        queue: nextQueue,
        originalQueue: nextOriginalQueue,
        currentIndex: nextIndex,
      });

      try {
        TrackPlayer.setMediaItems(nextQueue.map(toMediaItem), nextIndex);
        if (isPlaying && nextQueue.length > 0) TrackPlayer.play();
      } catch (e) {
        console.warn('[usePlayerStore] Falha ao atualizar a fila:', e);
      }
    },

    toggleShuffle: () => {
      const { shuffleEnabled, originalQueue, currentTrack } = get();
      const next = !shuffleEnabled;
      set({ shuffleEnabled: next });
      get().syncPreferences();

      TrackPlayer.setShuffleEnabled(next);

      // Ao desligar o shuffle, restaura a ordem original mantendo a faixa atual
      if (!next && currentTrack) {
        const newIndex = Math.max(
          0,
          originalQueue.findIndex((t) => t.id === currentTrack.id)
        );
        set({ queue: originalQueue, currentIndex: newIndex });
      }
    },

    cycleRepeat: () => {
      const { repeatMode } = get();
      const next: RepeatMode =
        repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
      set({ repeatMode: next });
      TrackPlayer.setRepeatMode(toNativeRepeatMode(next));
    },

    setSleepTimer: (minutes) => {
      if (minutes === null) {
        TrackPlayer.cancelSleepTimer();
        set({ sleepTimerEnd: null });
      } else {
        TrackPlayer.sleepAfterTime(minutes * 60, { fadeOutSeconds: 10 });
        set({ sleepTimerEnd: Date.now() + minutes * 60 * 1000 });
      }
    },

    addListenedSeconds: (seconds) => {
      if (seconds > 0) {
        const next = get().listenedSeconds + seconds;
        set({ listenedSeconds: next });

        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
          get().syncPreferences();
        }, 2000);
      } else if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
          get().syncPreferences();
        }, 0);
      }
    },

    loadListenedSeconds: async () => {
      const userId = auth.currentUser?.uid;
      try {
        const raw = await AsyncStorage.getItem(getScopedStorageKey(LISTENED_KEY, userId));
        const value = raw ? Number(raw) : 0;
        set({ listenedSeconds: Number.isFinite(value) ? value : 0 });
      } catch {
        set({ listenedSeconds: 0 });
      }
    },

    resetListenedSeconds: async () => {
      set({ listenedSeconds: 0 });
      await AsyncStorage.setItem(
        getScopedStorageKey(LISTENED_KEY),
        '0',
      );
      await get().syncPreferences();
    },

    setEqPreset: (preset, bands) => {
      if (bands) set({ eqPreset: preset, eqBands: bands });
      else set({ eqPreset: preset });
      get().syncPreferences();
    },

    setEqBand: (index, value) => {
      const { eqBands } = get();
      const newBands = [...eqBands];
      newBands[index] = value;
      set({ eqBands: newBands, eqPreset: 'Custom' });
      get().syncPreferences();
    },

    loadPreferences: async () => {
      const userId = auth.currentUser?.uid;
      const prefsKey = getScopedStorageKey(PLAYER_PREFS_KEY, userId);
      const listenedKey = getScopedStorageKey(LISTENED_KEY, userId);

      // Nunca reutiliza em memória as preferências da conta anterior enquanto
      // as preferências desta conta ainda estão sendo carregadas.
      set({
        listenedSeconds: 0,
        shuffleEnabled: false,
        eqPreset: 'Flat',
        eqBands: DEFAULT_EQ_BANDS,
      });

      let localPrefs: PlayerPrefs = {};
      try {
        const rawPrefs = await AsyncStorage.getItem(prefsKey);
        localPrefs = rawPrefs ? JSON.parse(rawPrefs) : {};
      } catch {
        localPrefs = {};
      }

      try {
        const rawListened = await AsyncStorage.getItem(listenedKey);
        const listenedSeconds = rawListened ? Number(rawListened) : localPrefs.listenedSeconds ?? 0;

        // Evita que uma leitura iniciada para a conta anterior sobrescreva a
        // memória depois de uma troca de sessão.
        if (auth.currentUser?.uid !== userId) return;

        set({
          listenedSeconds: Number.isFinite(listenedSeconds) ? listenedSeconds : 0,
          shuffleEnabled: localPrefs.shuffleEnabled ?? false,
          eqPreset: localPrefs.eqPreset ?? 'Flat',
          eqBands: Array.isArray(localPrefs.eqBands) && localPrefs.eqBands.length === 5
            ? localPrefs.eqBands
            : DEFAULT_EQ_BANDS,
        });
      } catch {
        set({ listenedSeconds: 0 });
      }

      // A conta pode ter mudado enquanto o cache era lido.
      if (auth.currentUser?.uid !== userId) return;

      const settingsRef = getPlayerSettingsRef(userId);
      if (!settingsRef) return;

      try {
        const snapshot = await getDoc(settingsRef);
        if (auth.currentUser?.uid !== userId) return;
        if (!snapshot.exists()) return;

        const remote = snapshot.data() as PlayerPrefs;
        set({
          listenedSeconds: Number.isFinite(remote.listenedSeconds)
            ? remote.listenedSeconds ?? get().listenedSeconds
            : get().listenedSeconds,
          shuffleEnabled: remote.shuffleEnabled ?? get().shuffleEnabled,
          eqPreset: remote.eqPreset ?? get().eqPreset,
          eqBands: Array.isArray(remote.eqBands) && remote.eqBands.length === 5
            ? remote.eqBands
            : get().eqBands,
        });
        await get().syncPreferences();
      } catch (e) {
        console.warn('[usePlayerStore] Falha ao carregar preferências:', e);
      }
    },

    syncPreferences: async () => {
      const userId = auth.currentUser?.uid;
      const { listenedSeconds, shuffleEnabled, eqPreset, eqBands } = get();
      const prefs: PlayerPrefs = {
        listenedSeconds,
        shuffleEnabled,
        eqPreset,
        eqBands,
      };

      await persistPlayerPrefsLocal(prefs, userId).catch(() => {});
      await AsyncStorage.setItem(
        getScopedStorageKey(LISTENED_KEY, userId),
        String(listenedSeconds),
      ).catch(() => {});

      if (remotePersistTimer) clearTimeout(remotePersistTimer);
      remotePersistTimer = setTimeout(() => {
        // Não deixa uma gravação agendada pela conta anterior atingir a conta
        // que acabou de entrar.
        if (auth.currentUser?.uid !== userId) return;
        const settingsRef = getPlayerSettingsRef(userId);
        if (!settingsRef) return;
        setDoc(settingsRef, { ...prefs, updatedAt: Date.now() }, { merge: true }).catch((e) =>
          console.warn('[usePlayerStore] Falha ao salvar preferências:', e),
        );
      }, 600);
    },
  };
});
