import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SIZES } from '../constants/theme';

// ─── Types ───────────────────────────────────────────────────

export interface SongListItemProps {
  id: string;
  title: string;
  artist?: string;
  duration?: number;         // seconds
  artwork?: string | null;   // URI
  isPlaying?: boolean;       // currently active in player
  isLoading?: boolean;       // buffering
  index?: number;            // show track number instead of artwork
  showIndex?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  rightAction?: React.ReactNode; // e.g. "⋯" menu button
}

// ─── Helpers ─────────────────────────────────────────────────

const formatDuration = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Animated equalizer bars (shown when isPlaying) ──────────

const EqualizerBars: React.FC = () => {
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.8)).current;
  const bar3 = useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    const animate = (anim: Animated.Value, toValue: number, duration: number) =>
      Animated.sequence([
        Animated.timing(anim, { toValue, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1 - toValue, duration, useNativeDriver: true }),
      ]);

    const loop1 = Animated.loop(animate(bar1, 0.2, 300));
    const loop2 = Animated.loop(animate(bar2, 0.1, 450));
    const loop3 = Animated.loop(animate(bar3, 0.3, 375));

    loop1.start();
    loop2.start();
    loop3.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [bar1, bar2, bar3]);

  return (
    <View style={styles.eqContainer}>
      {[bar1, bar2, bar3].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.eqBar,
            { transform: [{ scaleY: anim }] },
          ]}
        />
      ))}
    </View>
  );
};

// ─── Artwork / Index placeholder ─────────────────────────────

const ArtworkCell: React.FC<{
  artwork?: string | null;
  title: string;
  isPlaying: boolean;
  isLoading: boolean;
  index?: number;
  showIndex?: boolean;
}> = ({ artwork, title, isPlaying, isLoading, index, showIndex }) => {
  const initial = title.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.artworkWrapper}>
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.artwork} />
      ) : (
        <View style={styles.artworkPlaceholder}>
          {showIndex && index !== undefined ? (
            <Text style={styles.indexText}>{index + 1}</Text>
          ) : (
            <Text style={styles.initialText}>{initial}</Text>
          )}
        </View>
      )}

      {/* Overlay when playing or loading */}
      {(isPlaying || isLoading) && (
        <View style={styles.artworkOverlay}>
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.accent.primary} />
          ) : (
            <EqualizerBars />
          )}
        </View>
      )}
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────

export const SongListItem: React.FC<SongListItemProps> = ({
  title,
  artist,
  duration,
  artwork,
  isPlaying = false,
  isLoading = false,
  index,
  showIndex = false,
  onPress,
  onLongPress,
  onDelete,
  rightAction,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const appear = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      delay: Math.min((index ?? 0) * 18, 180),
      useNativeDriver: true,
    }).start();
  }, [appear, index]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const translateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [{ translateY }, { scale }],
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[styles.container, isPlaying && styles.containerActive]}
      >
        <ArtworkCell
          artwork={artwork}
          title={title}
          isPlaying={isPlaying}
          isLoading={isLoading}
          index={index}
          showIndex={showIndex}
        />

        {/* Text info */}
        <View style={styles.info}>
          <Text
            style={[styles.title, isPlaying && styles.titleActive]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {artist ? (
            <Text style={styles.artist} numberOfLines={1}>
              {artist}
            </Text>
          ) : null}
        </View>

        {/* Right side: duration + delete + optional action */}
        <View style={styles.right}>
          {duration ? (
            <Text style={styles.duration}>{formatDuration(duration)}</Text>
          ) : null}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.semantic.error} />
            </TouchableOpacity>
          )}
          {rightAction ?? null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const ARTWORK_SIZE = SIZES.cover.md; // 56

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.listItemPaddingV,
    backgroundColor: COLORS.transparent,
  },
  containerActive: {
    backgroundColor: COLORS.bg.highlight,
  },

  // ── Artwork ──
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: RADIUS.coverSmall,
    overflow: 'hidden',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: RADIUS.coverSmall,
  },
  artworkPlaceholder: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: RADIUS.coverSmall,
    backgroundColor: COLORS.bg.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.coverSmall,
  },
  initialText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.tertiary,
    fontSize: 20,
  },
  indexText: {
    ...TYPOGRAPHY.numeric,
    color: COLORS.text.tertiary,
    fontSize: 14,
  },

  // ── Equalizer ──
  eqContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  },
  eqBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: COLORS.accent.primary,
    transformOrigin: 'bottom' as never,
  },

  // ── Info ──
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
  },
  titleActive: {
    color: COLORS.accent.primary,
  },
  artist: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
  },

  // ── Right ──
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginLeft: SPACING.sm,
    flexShrink: 0,
  },
  duration: {
    ...TYPOGRAPHY.numeric,
    color: COLORS.text.tertiary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
});
