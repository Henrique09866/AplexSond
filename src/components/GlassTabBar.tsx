import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { usePlayerStore } from '../store/usePlayerStore';
import { MiniPlayer } from './MiniPlayer';
import {
  TYPOGRAPHY,
  SPACING,
  SHADOWS,
} from '../constants/theme';

// ─── Tab definitions (unchanged routes) ──────────────────────

type TabRoute = {
  key: string;
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TABS: TabRoute[] = [
  {
    key: 'Library',
    name: 'Library',
    label: 'Biblioteca',
    icon: 'library-outline',
    iconActive: 'library',
  },
  {
    key: 'Recents',
    name: 'Recents',
    label: 'Recentes',
    icon: 'time-outline',
    iconActive: 'time',
  },
  {
    key: 'Folders',
    name: 'Folders',
    label: 'Pastas',
    icon: 'folder-outline',
    iconActive: 'folder',
  },
  {
    key: 'Playlists',
    name: 'Playlists',
    label: 'Playlists',
    icon: 'list-outline',
    iconActive: 'list',
  },
];

// ─── Identity (vermelho e preto) ──────────────────────────────
const ACCENT_RED = '#E50914';
const GLASS_BG = 'rgba(8,8,8,0.72)';

// ─── Spring configs ───────────────────────────────────────────

const SPRING = { damping: 18, stiffness: 180, mass: 0.9 };
const SCALE_SPRING = { damping: 14, stiffness: 220, mass: 0.8 };

// ─── Component ────────────────────────────────────────────────

export const GlassTabBar: React.FC<any> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrev = usePlayerStore((s) => s.skipPrev);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);

  const progress = duration > 0 ? position / duration : 0;

  // ── Animated indicator ──────────────────────────────────────
  const [containerWidth, setContainerWidth] = useState(0);
  const [miniExpanded, setMiniExpanded] = useState(false);
  const indicatorX = useSharedValue(0);

  const tabWidth = containerWidth > 0 ? containerWidth / TABS.length : 0;

  useEffect(() => {
    if (tabWidth > 0) {
      indicatorX.value = withSpring(state.index * tabWidth, SPRING);
    }
  }, [state.index, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // ── Render ──────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
      ]}
      pointerEvents="box-none"
    >
      {currentTrack && (
        <View style={styles.miniWrapper}>
          {miniExpanded && (
            <MiniPlayer
              title={currentTrack.title}
              artist={currentTrack.artist}
              artwork={currentTrack.artwork}
              isPlaying={isPlaying}
              progress={progress}
              onPlayPause={isPlaying ? pause : play}
              onPrev={skipPrev}
              onNext={skipNext}
              onPress={() => {
                setMiniExpanded(false);
                navigation.navigate('PlayerScene' as never);
              }}
            />
          )}

          {/* Toggle arrow */}
          <TouchableOpacity
            onPress={() => setMiniExpanded((v) => !v)}
            style={[styles.toggleArrow, { bottom: insets.bottom + SPACING.tabBarHeight + 2 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={miniExpanded ? 'Recolher player' : 'Mostrar player'}
          >
            <Ionicons
              name={miniExpanded ? 'chevron-down' : 'chevron-up'}
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.capsuleOuter}>
        <BlurView
          intensity={70}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          blurReductionFactor={4}
          style={StyleSheet.absoluteFill}
        />
        {/* Translucent glass overlay */}
        <View style={styles.glassOverlay} />

        <View style={styles.capsuleInner} onLayout={handleLayout}>
          {/* Sliding active indicator */}
          {tabWidth > 0 && (
            <Animated.View
              style={[
                styles.indicator,
                { width: tabWidth - 12 },
                indicatorStyle,
              ]}
              pointerEvents="none"
            />
          )}

          {TABS.map((tab, index) => {
            const isFocused = state.index === index;
            return (
              <TabButton
                key={tab.key}
                tab={tab}
                isFocused={isFocused}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: state.routes[index].key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(tab.name as never);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

// ─── Tab Button (animated) ────────────────────────────────────

const TabButton: React.FC<{
  tab: TabRoute;
  isFocused: boolean;
  onPress: () => void;
}> = ({ tab, isFocused, onPress }) => {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(isFocused ? 1.12 : 1);
  const labelOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    iconScale.value = withSpring(isFocused ? 1.12 : 1, SCALE_SPRING);
    labelOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused, iconScale, labelOpacity]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: labelOpacity.value === 0 ? 4 : 0 }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.88, SCALE_SPRING);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SCALE_SPRING);
  }, [scale]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={animatedWrapperStyle}>
        <Animated.View style={animatedIconStyle}>
          <Ionicons
            name={isFocused ? tab.iconActive : tab.icon}
            size={22}
            color={isFocused ? ACCENT_RED : '#FFFFFF'}
          />
        </Animated.View>
        <Animated.Text
          style={[
            styles.tabLabel,
            { color: isFocused ? ACCENT_RED : 'rgba(255,255,255,0.7)' },
            animatedLabelStyle,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 60,
  },
  miniWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  toggleArrow: {
    position: 'absolute',
    alignSelf: 'center',
    width: 36,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(8,8,8,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  capsuleOuter: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    ...SHADOWS.float,
    backgroundColor: Platform.OS === 'android' ? GLASS_BG : 'transparent',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS_BG,
  },
  capsuleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(229,9,20,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.35)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  tabLabel: {
    ...TYPOGRAPHY.label,
    fontSize: 11,
    fontWeight: '600',
  },
});
