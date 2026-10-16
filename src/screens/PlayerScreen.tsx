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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
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
const DESKTOP_COVER_SIZE = 360;

// ─── Detecta desktop (Electron/web) ────────────────────────────
const useIsDesktop = (): boolean => {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 900;
};

// ─── Icon helpers (sem dep externa) ────────────────────────────

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

// ─── Formatação de tempo (segundos) ────────────────────────────

const fmt = (secs: number): string => {
  const total = Math.floor(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Slider de busca (funciona no celular e no PC) ─────────────
// Usa @react-native-community/slider em vez de PanResponder:
// - no celular o dedo não "reseta" a posição enquanto arrasta;
// - no PC funciona com mouse naturalmente.

const SeekSlider: React.FC<{
  progress: number;  // 0–1
  duration: number;
  position: number;
  onSeek: (secs: number) => void;
}> = ({ progress, duration, position, onSeek }) => {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview]   = useState(0);
  const previewRef              = useRef(0);

  // Enquanto o usuário está arrastando, mostra o valor prévio do dedo/mouse
  // e ignora as atualizações de posição da música. Isso evita o "pulou de volta".
  const showProgress = dragging ? preview : progress;
  const showPosition = dragging ? preview * duration : position;

  return (
    <View style={sliderStyles.wrapper}>
      <Slider
        style={sliderStyles.track}
        minimumValue={0}
        maximumValue={1}
        value={showProgress}
        minimumTrackTintColor={COLORS.accent.primary}
        maximumTrackTintColor={COLORS.border.default}
        thumbTintColor={COLORS.white}
        onSlidingStart={() => setDragging(true)}
        onValueChange={(v) => {
          setPreview(v);
          previewRef.current = v;
        }}
        onSlidingComplete={(v) => {
          previewRef.current = v;
          setDragging(false);
          onSeek(v * duration);
        }}
      />

      {/* Labels de tempo */}
      <View style={sliderStyles.timeRow}>
        <Text style={sliderStyles.time}>{fmt(showPosition)}</Text>
        <Text style={sliderStyles.time}>{fmt(duration)}</Text>
      </View>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  wrapper:  { paddingHorizontal: SPACING.screenPadding, gap: SPACING.sm },
  track:    { height: 52 }, // espaço para o polegar não encostar nos labels
  timeRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  time:     { ...TYPOGRAPHY.numeric, color: COLORS.text.tertiary },
});

// ─── Tela principal ─────────────────────────────────────────────

export const PlayerScreen: React.FC = () => {
  const insets     = useSafeAreaInsets();
  const isDesktop  = useIsDesktop();
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

  const [showLyrics, setShowLyrics] = useState(() => isDesktop && !!currentTrack?.lyrics);
  const [showEq, setShowEq] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');

  const progress = duration > 0 ? position / duration : 0;

  // ── Mover faixa para pasta ──
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

  // ── Animação da capa (pulsação quando toca) ──
  const coverScale = useRef(new Animated.Value(isPlaying ? 1 : 0.88)).current;

  React.useEffect(() => {
    Animated.spring(coverScale, {
      toValue: isPlaying ? 1 : 0.88,
      tension: 40,
      friction: 10,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [coverScale, isPlaying]);

  // ── Deslizar pra baixo fecha ──
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
            useNativeDriver: Platform.OS !== 'web',
          }).start(() => navigation.goBack());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 60,
            friction: 12,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      },
    }),
  ).current;

  // ── Volta atrás se a faixa sumir ──
  React.useEffect(() => {
    if (!currentTrack && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [currentTrack, navigation]);

  if (!currentTrack) {
    return null;
  }

  // ── Tamanho da capa (maior e fixo no PC, preenche a tela no celular) ──
  const coverSize = isDesktop ? DESKTOP_COVER_SIZE : COVER_SIZE;

  // ── Conteúdo da capa ──
  const coverContent = (
    <Animated.View
      style={[
        styles.coverWrapper,
        { width: coverSize, height: coverSize },
        { transform: [{ scale: coverScale }] },
      ]}
    >
      {currentTrack.artwork ? (
        <Image
          source={{ uri: currentTrack.artwork }}
          style={[styles.cover, { width: coverSize, height: coverSize }]}
        />
      ) : (
        <View style={[styles.coverFallback, { width: coverSize, height: coverSize }]}>
          <Text style={[styles.coverInitial, { fontSize: coverSize * 0.35 }]}>
            {currentTrack.title.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  const renderLyricsPanel = () => (
    <LyricsView
      lyrics={currentTrack.lyrics || ''}
      position={position}
      onEdit={openLyricsEditor}
    />
  );

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT PARA PC (capa + letras lado a lado)
  // ═══════════════════════════════════════════════════════════════
  if (isDesktop) {
    return (
      <Animated.View
        style={[styles.screen, { transform: [{ translateY }] }]}
        {...pan.panHandlers}
      >
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

        {/* Fundo levemente tintado com a cor da capa */ }
        <View style={styles.bgTint} />

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
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

        {/* Linha: capa à esquerda | letras à direita */}
        <View style={styles.desktopRow}>
          <View style={styles.desktopCoverCol}>{coverContent}</View>

          {showLyrics && currentTrack.lyrics ? (
            <View style={styles.desktopLyricsCol}>{renderLyricsPanel()}</View>
          ) : null}
        </View>

        {/* Info da faixa */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {currentTrack.artist ?? 'Artista desconhecido'}
          </Text>
        </View>

        {/* Slider de busca */}
        <SeekSlider
          progress={progress}
          duration={duration}
          position={position}
          onSeek={seekTo}
        />

        {/* Controles */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={skipPrev}
            style={styles.sideControl}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <IconPrev size={22} color={COLORS.text.primary} />
          </TouchableOpacity>

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

          <TouchableOpacity
            onPress={skipNext}
            style={styles.sideControl}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <IconNext size={22} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Ferramentas extras */}
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

        {/* Editor de letras */}
        <Modal
          visible={showLyricsEditor}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLyricsEditor(false)}
        >
          <View style={styles.lyricsModalBackdrop}>
            <View style={styles.lyricsModalSheet}>
              <Text style={styles.lyricsModalTitle}>Letras da música</Text>
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

        {/* Spacer inferior */}
        <View style={{ height: insets.bottom + SPACING.lg }} />
      </Animated.View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT PARA CELULAR (capa cheia, letras por toggle)
  // ═══════════════════════════════════════════════════════════════
  return (
    <Animated.View
      style={[styles.screen, { transform: [{ translateY }] }]}
      {...pan.panHandlers}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      {/* Fundo tintado */ }
      <View style={styles.bgTint} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
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

      {/* Capa ou Letras (toggle de tela cheia) */}
      <View style={styles.coverContainer}>
        {showLyrics ? (
          <LyricsView lyrics={currentTrack.lyrics || ''} position={position} onEdit={openLyricsEditor} />
        ) : (
          coverContent
        )}
      </View>

      {/* Info da faixa */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {currentTrack.artist ?? 'Artista desconhecido'}
        </Text>
      </View>

      {/* Slider de busca */}
      <SeekSlider
        progress={progress}
        duration={duration}
        position={position}
        onSeek={seekTo}
      />

      {/* Controles */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={skipPrev}
          style={styles.sideControl}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconPrev size={22} color={COLORS.text.primary} />
        </TouchableOpacity>

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

        <TouchableOpacity
          onPress={skipNext}
          style={styles.sideControl}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconNext size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Ferramentas extras */}
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

      {/* Editor de letras */}
      <Modal
        visible={showLyricsEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLyricsEditor(false)}
      >
        <View style={styles.lyricsModalBackdrop}>
          <View style={styles.lyricsModalSheet}>
            <Text style={styles.lyricsModalTitle}>Letras da música</Text>
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

      {/* Spacer inferior */}
      <View style={{ height: insets.bottom + SPACING.lg }} />
    </Animated.View>
  );
};

// ─── Estilos ───────────────────────────────────────────────────

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

  // ── Capa ──
  coverContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.xl,
  },
  coverWrapper: {
    borderRadius: RADIUS.coverLarge,
    ...SHADOWS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    borderRadius: RADIUS.coverLarge,
  },
  coverFallback: {
    borderRadius: RADIUS.coverLarge,
    backgroundColor: COLORS.bg.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverInitial: {
    fontWeight: '700',
    color: COLORS.text.tertiary,
  },

  // ── Desktop: linha capa | letras ──
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.xl,
  },
  desktopCoverCol: {
    alignItems: 'center',
  },
  desktopLyricsCol: {
    flex: 1,
    minWidth: 260,
  },

  // ── Info da faixa ──
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

  // ── Controles ──
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

  // ── Ferramentas ──
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
