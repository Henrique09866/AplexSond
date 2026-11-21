import { create } from 'zustand';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { Event, PlaybackState } from '@rntp/player';
import {
  setupTrackPlayer,
  toMediaItem,
  toNativeRepeatMode,
} from '../core/trackPlayerServices';
import { Track } from '../core/entities';

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
let endedAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSeekAt = 0;

type PlayerPrefs = {
  listenedSeconds?: number;
  shuffleEnabled?: boolean;
  eqPreset?: string;
  eqBands?: number[];
};

const persistPlayerPrefsLocal = async (prefs: PlayerPrefs) => {
  await AsyncStorage.setItem(PLAYER_PREFS_KEY, JSON.stringify(prefs));
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
      // Native advanced to another track — cancel any pending manual advance.
      if (endedAdvanceTimer) {
        clearTimeout(endedAdvanceTimer);
        endedAdvanceTimer = null;
      }
      set({
        currentIndex: index ?? get().currentIndex,
        currentTrack: item?.mediaId ? findTrackByMediaId(item.mediaId) : get().currentTrack,
        position: 0,
        isPlaying: true,
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
        const endedIndex = get().currentIndex;
        if (endedAdvanceTimer) clearTimeout(endedAdvanceTimer);
        endedAdvanceTimer = setTimeout(() => {
          endedAdvanceTimer = null;
          // If native already advanced (index changed), do nothing.
          if (get().currentIndex !== endedIndex) return;
          const { queue, repeatMode, shuffleEnabled, currentTrack } = get();
          if (!queue.length || !currentTrack) return;
          let nextIndex = -1;
          if (repeatMode === 'one') {
            nextIndex = endedIndex >= 0 ? endedIndex : 0;
          } else if (shuffleEnabled) {
            if (queue.length <= 1) return;
            do {
              nextIndex = Math.floor(Math.random() * queue.length);
            } while (nextIndex === endedIndex);
          } else {
            nextIndex = endedIndex + 1;
            if (nextIndex >= queue.length) {
              if (repeatMode === 'all') nextIndex = 0;
              else {
                try { TrackPlayer.stop(); } catch {}
                set({ isPlaying: false });
                return;
              }
            }
          }
          if (nextIndex < 0 || nextIndex >= queue.length) return;
          try {
            TrackPlayer.skipToIndex(nextIndex);
            TrackPlayer.play();
          } catch (e) {
            console.warn('[usePlayerStore] Falha ao avançar faixa:', e);
          }
        }, 400);
      }
    });

    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }) => {
      // Ignora posições reportadas logo após um seek, pois podem ser stale
      // (anteriores ao seek) e fariam o slider "voltar".
      if (Date.now() - lastSeekAt < 1200) {
        set({ duration: duration || get().duration });
        return;
      }
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

      // Usa o shuffle nativo do player (consistente com toggleShuffle),
      // evitando dois mecanismos de embaralhamento concorrentes.
      set({ shuffleEnabled: true });
      get().syncPreferences();
      await get().playQueue(tracks, 0);
      TrackPlayer.setShuffleEnabled(true);
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
      lastSeekAt = Date.now();
      set({ position: seconds });
      try {
        TrackPlayer.seekTo(seconds);
      } catch (e) {
        console.warn('[usePlayerStore] Falha ao buscar posição:', e);
      }
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
      const { shuffleEnabled } = get();
      const next = !shuffleEnabled;
      set({ shuffleEnabled: next });
      get().syncPreferences();
      TrackPlayer.setShuffleEnabled(next);
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
      try {
        const raw = await AsyncStorage.getItem(LISTENED_KEY);
        const value = raw ? Number(raw) : 0;
        set({ listenedSeconds: Number.isFinite(value) ? value : 0 });
      } catch {
        set({ listenedSeconds: 0 });
      }
    },

    resetListenedSeconds: async () => {
      set({ listenedSeconds: 0 });
      await AsyncStorage.setItem(LISTENED_KEY, '0');
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
      // Redefine para padrões antes de ler o cache local.
      set({
        listenedSeconds: 0,
        shuffleEnabled: false,
        eqPreset: 'Flat',
        eqBands: DEFAULT_EQ_BANDS,
      });

      let localPrefs: PlayerPrefs = {};
      try {
        const rawPrefs = await AsyncStorage.getItem(PLAYER_PREFS_KEY);
        localPrefs = rawPrefs ? JSON.parse(rawPrefs) : {};
      } catch {
        localPrefs = {};
      }

      try {
        const rawListened = await AsyncStorage.getItem(LISTENED_KEY);
        const listenedSeconds = rawListened ? Number(rawListened) : localPrefs.listenedSeconds ?? 0;

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
    },

    syncPreferences: async () => {
      const { listenedSeconds, shuffleEnabled, eqPreset, eqBands } = get();
      const prefs: PlayerPrefs = {
        listenedSeconds,
        shuffleEnabled,
        eqPreset,
        eqBands,
      };

      await persistPlayerPrefsLocal(prefs).catch(() => {});
      await AsyncStorage.setItem(LISTENED_KEY, String(listenedSeconds)).catch(() => {});
    },
  };
});
