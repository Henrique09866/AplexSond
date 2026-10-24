import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SHADOWS,
  hexToRgba,
  darken,
} from '../constants/theme';

// ─── Types ───────────────────────────────────────────────────

export interface FolderCardProps {
  name: string;
  color: string;           // hex from COLORS.folders palette
  trackCount: number;
  artworks?: (string | null)[]; // up to 4 cover URIs for collage
  artwork?: string | null;     // custom folder photo (overrides collage)
  onPress: () => void;
  onLongPress?: () => void;
  onDeleteFolder?: () => void;
  isReordering?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}

// ─── Artwork collage (2×2 grid inside card) ──────────────────

const ArtworkCollage: React.FC<{
  artworks: (string | null)[];
  color: string;
}> = ({ artworks, color }) => {
  const filled = [...artworks, null, null, null, null].slice(0, 4);
  const hasAny = artworks.some(Boolean);

  if (!hasAny) {
    return (
      <View style={[styles.collageSingle, { backgroundColor: darken(color, 0.45) }]}>
        <Ionicons name="musical-note" size={44} color={color} style={styles.collageIcon} />
      </View>
    );
  }

  if (artworks.filter(Boolean).length === 1) {
    return filled[0] ? (
      <Image source={{ uri: filled[0]! }} style={styles.collageSingle} />
    ) : (
      <View style={[styles.collageSingle, { backgroundColor: darken(color, 0.45) }]} />
    );
  }

  return (
    <View style={styles.collageGrid}>
      {filled.map((uri, i) =>
        uri ? (
          <Image key={i} source={{ uri }} style={styles.collageCell} />
        ) : (
          <View
            key={i}
            style={[styles.collageCell, { backgroundColor: darken(color, 0.45) }]}
          />
        )
      )}
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────

export const FolderCard: React.FC<FolderCardProps> = ({
  name,
  color,
  trackCount,
  artworks = [],
  artwork,
  onPress,
  onLongPress,
  onDeleteFolder,
  isReordering = false,
  canMoveLeft = false,
  canMoveRight = false,
  onMoveLeft,
  onMoveRight,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const appear = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(appear, {
      toValue: 1,
      tension: 55,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.95,
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

  const appearScale = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: appear,
          transform: [{ scale: appearScale }, { scale }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[styles.card, isReordering && styles.cardReordering]}
      >
        {isReordering ? (
          <View style={styles.reorderToolbar}>
            <TouchableOpacity
              onPress={onMoveLeft}
              disabled={!canMoveLeft}
              style={[styles.reorderButton, !canMoveLeft && styles.reorderButtonDisabled]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={canMoveLeft ? COLORS.text.primary : COLORS.text.disabled}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMoveRight}
              disabled={!canMoveRight}
              style={[styles.reorderButton, !canMoveRight && styles.reorderButtonDisabled]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canMoveRight ? COLORS.text.primary : COLORS.text.disabled}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onDeleteFolder?.()}
            style={styles.menuButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={COLORS.text.secondary}
            />
          </TouchableOpacity>
        )}

        {/* Color accent strip at top (hidden when folder has its own photo) */}
        {!artwork && <View style={[styles.colorStrip, { backgroundColor: color }]} />}

        {/* Artwork collage / folder photo */}
        <View style={styles.collageContainer}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.collageSingle} />
          ) : (
            <ArtworkCollage artworks={artworks} color={color} />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.countRow}>
            <View style={[styles.countBadge, { backgroundColor: hexToRgba(color, 0.18) }]}>
              <Text style={[styles.countText, { color }]}>
                {trackCount} {trackCount === 1 ? 'música' : 'músicas'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const COLLAGE_SIZE = 130;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardReordering: {
    borderWidth: 1,
    borderColor: COLORS.accent.primary,
  },
  reorderToolbar: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 4,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  reorderButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border.default,
  },
  reorderButtonDisabled: {
    opacity: 0.45,
  },
  menuButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 3,
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border.default,
  },

  // ── Color strip ──
  colorStrip: {
    height: 3,
    width: '100%',
  },

  // ── Collage ──
  collageContainer: {
    width: '100%',
    height: COLLAGE_SIZE,
    backgroundColor: COLORS.bg.highlight,
    overflow: 'hidden',
  },
  collageSingle: {
    width: '100%',
    height: COLLAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collageIcon: {
    opacity: 0.7,
  },
  collageGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  collageCell: {
    width: '50%',
    height: COLLAGE_SIZE / 2,
  },

  // ── Footer ──
  footer: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  name: {
    ...TYPOGRAPHY.titleLarge,
    color: COLORS.text.primary,
  },
  countRow: {
    flexDirection: 'row',
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.chip,
  },
  countText: {
    ...TYPOGRAPHY.label,
    fontWeight: '600',
  },
});
