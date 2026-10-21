import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SHADOWS,
  SIZES,
} from '../constants/theme';

// ─── Types ───────────────────────────────────────────────────

export interface MiniPlayerProps {
  title: string;
  artist?: string;
  artwork?: string | null;
  isPlaying: boolean;
  progress: number;          // 0–1
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPress: () => void;       // open full player
  onDismiss?: () => void;    // swipe down to close
}

// ─── Play/Pause icon (drawn manually — no icon lib dependency) ─

const PlayIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = COLORS.text.primary,
}) => (
  <View
    style={{
      width: 0,
      height: 0,
      borderTopWidth: size / 2,
      borderBottomWidth: size / 2,
      borderLeftWidth: size * 0.85,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color,
      marginLeft: 3,
    }}
  />
);

const PauseIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = COLORS.text.primary,
}) => (
  <View style={{ flexDirection: 'row', gap: 4 }}>
    {[0, 1].map((i) => (
      <View
        key={i}
        style={{
          width: size * 0.28,
          height: size,
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
    ))}
  </View>
);

const NextIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = COLORS.text.secondary,
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size / 2,
        borderBottomWidth: size / 2,
        borderLeftWidth: size * 0.7,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
    <View
      style={{
        width: 3,
        height: size,
        backgroundColor: color,
        borderRadius: 1,
        marginLeft: 2,
      }}
    />
  </View>
);

const PrevIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = COLORS.text.secondary,
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View
      style={{
        width: 3,
        height: size,
        backgroundColor: color,
        borderRadius: 1,
        marginRight: 2,
      }}
    />
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size / 2,
        borderBottomWidth: size / 2,
        borderRightWidth: size * 0.7,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightColor: color,
      }}
    />
  </View>
);

// ─── Main Component ──────────────────────────────────────────

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  title,
  artist,
  artwork,
  isPlaying,
  progress,
  onPlayPause,
  onPrev,
  onNext,
  onPress,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const swipeY = useRef(new Animated.Value(0)).current;

  // ── Mount animation ──
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 60,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  // ── Swipe-down to dismiss ──
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && g.dy > 0,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) swipeY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60) {
          Animated.timing(swipeY, {
            toValue: 200,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDismiss?.());
        } else {
          Animated.spring(swipeY, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const bottomOffset = insets.bottom + SPACING.tabBarHeight + SPACING.sm;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: bottomOffset },
        {
          transform: [
            { translateY: Animated.add(translateY, swipeY) },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Progress bar — sits flush at the top edge */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: `${Math.min(Math.max(progress * 100, 0), 100)}%` },
          ]}
        />
      </View>

      {/* Handle — visual cue for swipe */}
      <View style={styles.handleRow}>
        <View style={styles.handle} />
      </View>

      {/* Main row */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.95}
        style={styles.content}
      >
        {/* Artwork */}
        <View style={styles.artworkWrapper}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.artwork} />
          ) : (
            <View style={styles.artworkFallback}>
              <Text style={styles.artworkInitial}>
                {title.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Track info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {artist ? (
            <Text style={styles.artist} numberOfLines={1}>
              {artist}
            </Text>
          ) : null}
        </View>

        {/* Controls — stop propagation so they don't open player */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={onPrev}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={styles.controlButton}
          >
            <PrevIcon size={16} color={COLORS.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPlayPause}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={styles.controlButton}
          >
            {isPlaying ? (
              <PauseIcon size={18} color={COLORS.text.primary} />
            ) : (
              <PlayIcon size={18} color={COLORS.text.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNext}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
            style={styles.controlButton}
          >
            <NextIcon size={16} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const PLAYER_HEIGHT = SIZES.miniPlayerHeight; // 68
const ARTWORK_SIZE = SIZES.cover.xs + 8;      // 44

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
    height: PLAYER_HEIGHT,
    backgroundColor: COLORS.bg.overlay,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.float,
    // Subtle border for definition against dark bg
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border.default,
    zIndex: 50,
  },

  // ── Progress ──
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.border.subtle,
  },
  progressFill: {
    height: 2,
    backgroundColor: COLORS.accent.primary,
    borderRadius: 1,
  },

  // ── Handle ──
  handleRow: {
    alignItems: 'center',
    paddingTop: 6,
  },
  handle: {
    width: SIZES.sheet.handleWidth,
    height: SIZES.sheet.handleHeight,
    borderRadius: 2,
    backgroundColor: COLORS.border.strong,
  },

  // ── Content ──
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    gap: SPACING.md,
  },

  // ── Artwork ──
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: RADIUS.coverSmall,
    overflow: 'hidden',
    flexShrink: 0,
    ...SHADOWS.sm,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
  },
  artworkFallback: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    backgroundColor: COLORS.bg.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkInitial: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.tertiary,
    fontSize: 16,
  },

  // ── Info ──
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
  },
  artist: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
  },

  // ── Controls ──
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 0,
  },
  controlButton: {
    width: SIZES.button.iconButton,
    height: SIZES.button.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
