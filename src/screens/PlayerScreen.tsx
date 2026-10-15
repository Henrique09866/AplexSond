import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { LyricsView } from '../components/LyricsView';
import { EqualizerSheet } from '../components/EqualizerSheet';
import { SleepTimerSheet } from '../components/SleepTimerSheet';
import { SelectFolderModal } from '../components/SelectFolderModal';

import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore, useFoldersStore } from '../store';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SHADOWS,
  SIZES,
  hexToRgba,
} from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH - SPACING.screenPadding * 2;

// ─── Icon helpers (no external dep) ──────────────────────────

const IconPrev = ({ color = COLORS.text.primary, size = 24 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 3, height: size, backgroundColor: color, borderRadius: 2 }} />
    <View style={{ width: 0, height: 0, borderTopWidth: size / 2, borderBottomWidth: size / 2, borderRightWidth: size * 0.85, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color, marginLeft: 2 }} />
    <View style={{ width: 0, height: 0, borderTopWidth: size / 2, borderBottomWidth: size / 2, borderRightWidth: size * 0.85, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color, marginLeft: 1 }} />
  </View>
);

const IconNext = ({ color = COLORS.text.primary, size = 24 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 0, height: 0, borderTopWidth: size / 2, borderBottomWidth: size / 2, borderLeftWidth: size * 0.85, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color }} />
    <View style={{ width: 0, height: 0, borderTopWidth: size / 2, borderBottomWidth: size / 2, borderLeftWidth: size * 0.85, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color, marginLeft: 1 }} />
    <View style={{ width: 3, height: size, backgroundColor: color, borderRadius: 2, marginLeft: 2 }} />
  </View>
);

const IconPlay = ({ color = COLORS.text.inverse, size = 28 }) => (
  <View style={{ width: 0, height: 0, borderTopWidth: size / 2, borderBottomWidth: size / 2, borderLeftWidth: size, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color, marginLeft: 4 }} />
);

const IconPause = ({ color = COLORS.text.inverse, size = 26 }) => (
  <View style={{ flexDirection: 'row', gap: 6 }}>
    {[0, 1].map(i => (
      <View key={i} style={{ width: 4, height: size, backgroundColor: color, borderRadius: 2 }} />
    ))}
  </View>
);

// ─── Time formatter (accepts SECONDS from useProgress) ──────

const fmt = (secs: number): string => {
  const total = Math.floor(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Seek slider ─────────────────────────────────────────────

const SeekSlider: React.FC<{
  progress: number;  // 0–1
  duration: number;
  position: number;
  onSeek: (secs: number) => void;
}> = ({ progress, duration, position, onSeek }) => {
  const TRACK_WIDTH = SCREEN_WIDTH - SPACING.screenPadding * 2;
  const [dragging, setDragging] = useState(false);
  const [dragVal, setDragVal]   = useState(0);
  const thumbScale              = useRef(new Animated.Value(1)).current;
  const dragValRef              = useRef(0);

  const expandThumb = () =>
    Animated.spring(thumbScale, { toValue: 1.5, tension: 80, friction: 10, useNativeDriver: true }).start();
  const shrinkThumb = () =>
    Animated.spring(thumbScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gestureState) => {
        setDragging(true);
        expandThumb();
        const startX = gestureState.x0 - SPACING.screenPadding;
        const v = Math.max(0, Math.min(startX / TRACK_WIDTH, 1));
        dragValRef.current = v;
        setDragVal(v);
      },
      onPanResponderMove: (e, gestureState) => {
        const currentX = gestureState.moveX - SPACING.screenPadding;
        const v = Math.max(0, Math.min(currentX / TRACK_WIDTH, 1));
        dragValRef.current = v;
        setDragVal(v);
      },
      onPanResponderRelease: () => {
        shrinkThumb();
        setDragging(false);
        onSeek(dragValRef.current * duration);
      },
    }),
  ).current;

  const fill = dragging ? dragVal : progress;
  const displayPos = dragging ? dragVal * duration : position;

  return (
    <View style={sliderStyles.wrapper}>
      {/* Track */}
      <View style={sliderStyles.track} {...pan.panHandlers}>
        <View style={[sliderStyles.fill, { width: `${fill * 100}%` }]} />
        {/* Thumb */}
        <Animated.View
          style={[
            sliderStyles.thumb,
            {
              left: `${fill * 100}%`,
              transform: [{ scale: thumbScale }, { translateX: -SIZES.player.sliderThumb / 2 }],
            },
          ]}
        />
      </View>

      {/* Time labels */}
      <View style={sliderStyles.timeRow}>
        <Text style={sliderStyles.time}>{fmt(displayPos)}</Text>
        <Text style={sliderStyles.time}>{fmt(duration)}</Text>
      </View>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  wrapper:  { paddingHorizontal: SPACING.screenPadding, gap: SPACING.sm },
  track:    { height: 4, backgroundColor: COLORS.border.default, borderRadius: 2, position: 'relative', justifyContent: 'center' },
  fill:     { height: 4, backgroundColor: COLORS.accent.primary, borderRadius: 2, position: 'absolute', left: 0 },
  thumb: {
    position: 'absolute',
    width: SIZES.player.sliderThumb,
    height: SIZES.player.sliderThumb,
    borderRadius: SIZES.player.sliderThumb / 2,
    backgroundColor: COLORS.white,
    top: -(SIZES.player.sliderThumb / 2 - 2),
    ...SHADOWS.sm,
  },
  timeRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  time:     { ...TYPOGRAPHY.numeric, color: COLORS.text.tertiary },
});

// ─── Main Screen ──────────────────────────────────────────────

export const PlayerScreen: React.FC = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying    = usePlayerStore((s) => s.isPlaying);
  
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);

  const tracks            = useLibraryStore((s) => s.tracks);
  const updateTrackFolder = useLibraryStore((s) => s.updateTrackFolder);
  const updateTrack       = useLibraryStore((s) => s.updateTrack);
  const loadFolders       = useFoldersStore((s) => s.load);

  const play         = usePlayerStore((s) => s.play);
  const pause        = usePlayerStore((s) => s.pause);
  const skipNext     = usePlayerStore((s) => s.skipNext);
  const skipPrev     = usePlayerStore((s) => s.skipPrev);
  const seekTo       = usePlayerStore((s) => s.seekTo);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const repeatMode   = usePlayerStore((s) => s.repeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat   = usePlayerStore((s) => s.cycleRepeat);

  const [showLyrics, setShowLyrics] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');

  const progress = duration > 0 ? position / duration : 0;

  // ── Move track to folder ──
  const currentFolderId = currentTrack
    ? tracks.find((t) => t.id === currentTrack.id)?.folderId
    : undefined;

  const handleOpenMoveFolder = useCallback(() => {
    loadFolders();
    setShowMoveFolder(true);
  }, [loadFolders]);

  const handleMoveToFolder = useCallback(
    (folderId: string | undefined) => {
      if (currentTrack) {
        updateTrackFolder(currentTrack.id, folderId);
      }
    },
    [currentTrack, updateTrackFolder],
  );

  const openLyricsEditor = useCallback(() => {
    setLyricsDraft(currentTrack?.lyrics || '');
    setShowLyricsEditor(true);
  }, [currentTrack]);

  const handleSaveLyrics = useCallback(async () => {
    if (currentTrack) {
      await updateTrack(currentTrack.id, { lyrics: lyricsDraft });
    }
    setShowLyricsEditor(false);
  }, [currentTrack, lyricsDraft, updateTrack]);

  // ── Cover scale animation (pulses when playing) ──
  const coverScale = useRef(new Animated.Value(isPlaying ? 1 : 0.88)).current;

  React.useEffect(() => {
    Animated.spring(coverScale, {
      toValue: isPlaying ? 1 : 0.88,
      tension: 40,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [coverScale, isPlaying]);

  // ── Swipe down to close ──
  const translateY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 60,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // ── Safe navigation goBack if track becomes null ──
  React.useEffect(() => {
    if (!currentTrack && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [currentTrack, navigation]);

  if (!currentTrack) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.screen, { transform: [{ translateY }] }]}
      {...pan.panHandlers}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      {/* ── Background tint from artwork color (static dark) ── */}
      <View style={styles.bgTint} />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        <View style={styles.topBarRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.topBarButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-down" size={28} color={COLORS.text.primary} />
          </TouchableOpacity>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarLabel}>TOCANDO AGORA</Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenMoveFolder}
            style={styles.topBarButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={currentFolderId ? 'folder' : 'folder-outline'}
              size={22}
              color={currentFolderId ? COLORS.accent.primary : COLORS.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Cover art ou Lyrics ── */}
      <View style={styles.coverContainer}>
        {showLyrics ? (
          <LyricsView lyrics={currentTrack.lyrics || ''} position={position} onEdit={openLyricsEditor} />
        ) : (
          <Animated.View
            style={[
              styles.coverWrapper,
              { transform: [{ scale: coverScale }] },
            ]}
          >
            {currentTrack.artwork ? (
              <Image
                source={{ uri: currentTrack.artwork }}
                style={styles.cover}
              />
            ) : (
              <View style={styles.coverFallback}>
                <Text style={styles.coverInitial}>
                  {currentTrack.title.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>

      {/* ── Track info ── */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {currentTrack.artist ?? 'Artista desconhecido'}
        </Text>
      </View>

      {/* ── Seek slider ── */}
      <SeekSlider
        progress={progress}
        duration={duration}
        position={position}
        onSeek={seekTo}
      />

      {/* ── Controls ── */}
      <View style={styles.controls}>
        {/* Prev */}
        <TouchableOpacity
          onPress={skipPrev}
          style={styles.sideControl}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconPrev size={22} color={COLORS.text.primary} />
        </TouchableOpacity>

        {/* Play / Pause */}
        <TouchableOpacity
          onPress={isPlaying ? pause : play}
          style={styles.playButton}
          activeOpacity={0.85}
        >
          {isPlaying ? (
            <IconPause size={26} color={COLORS.text.inverse} />
          ) : (
            <IconPlay size={28} color={COLORS.text.inverse} />
          )}
        </TouchableOpacity>

        {/* Next */}
        <TouchableOpacity
          onPress={skipNext}
          style={styles.sideControl}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconNext size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Extra Tools (Shuffle, Repeat, EQ, Lyrics, Timer) ── */}
      <View style={styles.toolsRow}>
        <TouchableOpacity onPress={toggleShuffle} style={[styles.toolBtn, shuffleEnabled && styles.toolBtnActive]}>
          <Ionicons name="shuffle-outline" size={24} color={shuffleEnabled ? COLORS.white : COLORS.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={cycleRepeat} style={[styles.toolBtn, repeatMode !== 'off' && styles.toolBtnActive]}>
          <Ionicons name={repeatMode === 'one' ? "repeat-outline" : "repeat-outline"} size={24} color={repeatMode !== 'off' ? COLORS.white : COLORS.text.secondary} />
          {repeatMode === 'one' && (
            <Text style={[styles.repeatBadge, { color: COLORS.white }]}>1</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowEq(true)} style={styles.toolBtn}>
          <Ionicons name="options-outline" size={24} color={COLORS.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (currentTrack?.lyrics) {
              setShowLyrics(!showLyrics);
            } else {
              openLyricsEditor();
            }
          }}
          style={[styles.toolBtn, showLyrics && styles.toolBtnActive]}
        >
          <Ionicons name="text-outline" size={24} color={showLyrics ? COLORS.white : COLORS.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowSleepTimer(true)} style={styles.toolBtn}>
          <Ionicons name="timer-outline" size={24} color={COLORS.text.secondary} />
        </TouchableOpacity>
      </View>

      <EqualizerSheet visible={showEq} onClose={() => setShowEq(false)} />
      <SleepTimerSheet visible={showSleepTimer} onClose={() => setShowSleepTimer(false)} />

      {/* �"?�"? Editor de letras �"?�"? */}
      <Modal
        visible={showLyricsEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLyricsEditor(false)}
      >
        <View style={styles.lyricsModalBackdrop}>
          <View style={styles.lyricsModalSheet}>
            <Text style={styles.lyricsModalTitle}>Letras da m��sica</Text>
            <TextInput
              style={styles.lyricsModalInput}
              value={lyricsDraft}
              onChangeText={setLyricsDraft}
              placeholder="Cole as letras aqui (texto ou LRC)..."
              placeholderTextColor={COLORS.text.tertiary}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.lyricsModalButtons}>
              <TouchableOpacity
                style={[styles.lyricsModalButton, styles.lyricsModalButtonGhost]}
                onPress={() => setShowLyricsEditor(false)}
              >
                <Text style={styles.lyricsModalButtonGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lyricsModalButton, styles.lyricsModalButtonPrimary]}
                onPress={handleSaveLyrics}
              >
                <Text style={styles.lyricsModalButtonPrimaryText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SelectFolderModal
        visible={showMoveFolder}
        onClose={() => setShowMoveFolder(false)}
        onSelect={handleMoveToFolder}
        currentFolderId={currentFolderId}
      />

      {/* ── Bottom spacer ── */}
      <View style={{ height: insets.bottom + SPACING.lg }} />
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg.base,
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: hexToRgba(COLORS.accent.primary, 0.04),
  },

  // ── Top bar ──
  topBar: {
    alignItems: 'center',
    paddingHorizontal: SPACING.screenPadding,
    gap: SPACING.sm,
  },
  handle: {
    width: SIZES.sheet.handleWidth,
    height: SIZES.sheet.handleHeight,
    borderRadius: 2,
    backgroundColor: COLORS.border.strong,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarLabel: {
    ...TYPOGRAPHY.overline,
  },
  chevronDown: {
    fontSize: 28,
    color: COLORS.text.primary,
    lineHeight: 34,
    fontWeight: '300',
  },

  // ── Cover ──
  coverContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.xl,
  },
  coverWrapper: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: RADIUS.coverLarge,
    ...SHADOWS.lg,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: RADIUS.coverLarge,
  },
  coverFallback: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: RADIUS.coverLarge,
    backgroundColor: COLORS.bg.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverInitial: {
    fontSize: COVER_SIZE * 0.35,
    fontWeight: '700',
    color: COLORS.text.tertiary,
  },

  // ── Track info ──
  trackInfo: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  trackTitle: {
    ...TYPOGRAPHY.h2,
  },
  trackArtist: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
  },

  // ── Controls ──
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.xl,
    gap: SPACING['3xl'],
  },
  playButton: {
    width: SIZES.player.playButton,
    height: SIZES.player.playButton,
    borderRadius: SIZES.player.playButton / 2,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.accentGlow,
  },
  sideControl: {
    width: SIZES.player.controlButton,
    height: SIZES.player.controlButton,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Extra Tools ──
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.screenPadding,
    marginTop: SPACING.xl,
    gap: SPACING.xl,
  },
  toolBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.bg.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: COLORS.accent.primary,
  },
  repeatBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    fontSize: 10,
    fontWeight: '700',
  },
  lyricsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  lyricsModalSheet: {
    backgroundColor: COLORS.bg.overlay,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    padding: SPACING.screenPadding,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  lyricsModalTitle: {
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  lyricsModalInput: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.bg.input,
    color: COLORS.text.primary,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border.default,
    padding: SPACING.md,
    minHeight: 200,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  lyricsModalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  lyricsModalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricsModalButtonGhost: {
    backgroundColor: COLORS.bg.highlight,
  },
  lyricsModalButtonPrimary: {
    backgroundColor: COLORS.accent.primary,
  },
  lyricsModalButtonGhostText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.secondary,
  },
  lyricsModalButtonPrimaryText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.onAccent,
    fontWeight: '700',
  },
});
