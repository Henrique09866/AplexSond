import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  NavigationContainer,
  DefaultTheme,
} from '@react-navigation/native';
import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionSpecs,
} from '@react-navigation/stack';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import { navigationRef } from './navigationRef';
import { useNavigation } from '@react-navigation/native';

import {
  LibraryScreen,
  RecentsScreen,
  PlaylistsScreen,
  PlaylistDetailsScreen,
  FoldersScreen,
  FolderDetailsScreen,
  PlayerScreen,
  ProfileScreen,
  SettingsScreen,
} from '../screens';
import { MiniPlayer } from '../components/MiniPlayer';
import { usePlayerStore } from '../store';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SIZES,
} from '../constants/theme';

// ─── Desktop constants ────────────────────────────────────────
// A partir dessa largura (e na web/Electron) o app usa o layout
// de desktop: sidebar à esquerda + barra de player em baixo.

export const DESKTOP_MIN_WIDTH = 900;
export const DESKTOP_SIDEBAR_WIDTH = 240;

export const APP_VERSION =
  Constants.expoConfig?.version ?? '1.0.4';

export const useIsDesktop = (): boolean => {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
};

// ─── Navigation theme ─────────────────────────────────────────

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary:    COLORS.accent.primary,
    background: COLORS.bg.base,
    card:       COLORS.bg.base,
    text:       COLORS.text.primary,
    border:     COLORS.border.subtle,
    notification: COLORS.accent.primary,
  },
};

// ─── Tab definitions ──────────────────────────────────────────

type TabRoute = {
  key: string;
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TABS: TabRoute[] = [
  {
    key:        'Library',
    name:       'Library',
    label:      'Biblioteca',
    icon:       'library-outline',
    iconActive: 'library',
  },
  {
    key:        'Recents',
    name:       'Recents',
    label:      'Recentes',
    icon:       'time-outline',
    iconActive: 'time',
  },
  {
    key:        'Folders',
    name:       'Folders',
    label:      'Pastas',
    icon:       'folder-outline',
    iconActive: 'folder',
  },
  {
    key:        'Playlists',
    name:       'Playlists',
    label:      'Playlists',
    icon:       'list-outline',
    iconActive: 'list',
  },
];

// ─── Animated tab button ──────────────────────────────────────

const TabButton: React.FC<{
  tab: TabRoute;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ tab, isFocused, onPress, onLongPress }) => {
  const scale      = useRef(new Animated.Value(1)).current;
  const labelWidth = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const focusAnim  = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(labelWidth, {
        toValue: isFocused ? 1 : 0,
        tension: 60,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.spring(focusAnim, {
        toValue: isFocused ? 1 : 0,
        tension: 90,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focusAnim, isFocused, labelWidth]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.85,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const maxLabelWidth = labelWidth.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 80],
  });

  const labelOpacity = labelWidth.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });
  const iconScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });
  const iconTranslateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tab.label}
    >
      <Animated.View
        style={[
          styles.tabPill,
          {
            transform: [{ scale }],
            backgroundColor: isFocused
              ? COLORS.accent.muted
              : COLORS.transparent,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ translateY: iconTranslateY }, { scale: iconScale }] }}>
          <Ionicons
            name={isFocused ? tab.iconActive : tab.icon}
            size={SIZES.tabBar.iconSize}
            color={isFocused ? COLORS.accent.primary : COLORS.text.tertiary}
          />
        </Animated.View>

        <Animated.View
          style={{ maxWidth: maxLabelWidth, overflow: 'hidden' }}
        >
          <Animated.Text
            style={[styles.tabLabel, { opacity: labelOpacity }]}
            numberOfLines={1}
          >
            {tab.label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Custom tab bar ───────────────────────────────────────────

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets        = useSafeAreaInsets();
  const currentTrack  = usePlayerStore((s) => s.currentTrack);
  const isPlaying     = usePlayerStore((s) => s.isPlaying);
  const play         = usePlayerStore((s) => s.play);
  const pause        = usePlayerStore((s) => s.pause);
  const skipNext     = usePlayerStore((s) => s.skipNext);
  const skipPrev     = usePlayerStore((s) => s.skipPrev);

  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.tabBarWrapper}>
      {currentTrack && (
        <MiniPlayer
          title={currentTrack.title}
          artist={currentTrack.artist}
          artwork={currentTrack.artwork}
          isPlaying={isPlaying}
          progress={progress}
          onPlayPause={isPlaying ? pause : play}
          onPrev={skipPrev}
          onNext={skipNext}
          onPress={() => navigation.navigate('PlayerScene' as never)}
        />
      )}

      <View
        style={[
          styles.tabBar,
          { paddingBottom: insets.bottom + SPACING.sm },
        ]}
      >
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[index].key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name as never);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: state.routes[index].key,
            });
          };

          return (
            <TabButton
              key={tab.key}
              tab={tab}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
};

// ─── Navigators ───────────────────────────────────────────────

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const DesktopSidebar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets     = useSafeAreaInsets();
  const activeIndex = state.index;

  const handlePress = (index: number) => {
    const route = state.routes[index];
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented && activeIndex !== index) {
      navigation.navigate(route.name as never);
    }
  };

  const handleOpen = (screen: string) => {
    navigation.navigate(screen as never);
  };

  return (
    <View style={[dStyles.sidebar, { paddingTop: insets.top + SPACING.lg }]}>
      {/* ── Marca ── */}
      <View style={dStyles.logoBlock}>
        <View style={dStyles.logoContainer}>
          <Image
            source={require('../../assets/images/logoaplexsond.png')}
            style={dStyles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={dStyles.logoText}>AplexSond</Text>
      </View>

      {/* ── Navegação principal ── */}
      <View style={dStyles.nav}>
        {TABS.map((tab, index) => {
          const focused = activeIndex === index;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handlePress(index)}
              activeOpacity={0.85}
              style={[dStyles.navItem, focused && dStyles.navItemActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
            >
              <View
                style={[dStyles.navIndicator, focused && dStyles.navIndicatorActive]}
              />
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={SIZES.icon.md}
                color={focused ? COLORS.accent.primary : COLORS.text.secondary}
              />
              <Text
                style={[dStyles.navLabel, focused && dStyles.navLabelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Rodapé da sidebar ── */}
      <View style={dStyles.bottomNav}>
        <TouchableOpacity
          style={dStyles.bottomNavItem}
          activeOpacity={0.85}
          onPress={() => handleOpen('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Perfil"
        >
          <Ionicons
            name="person-circle-outline"
            size={SIZES.icon.lg}
            color={COLORS.text.secondary}
          />
          <Text style={dStyles.bottomNavLabel}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={dStyles.bottomNavItem}
          activeOpacity={0.85}
          onPress={() => handleOpen('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Configurações"
        >
          <Ionicons
            name="settings-outline"
            size={SIZES.icon.lg}
            color={COLORS.text.secondary}
          />
          <Text style={dStyles.bottomNavLabel}>Configurações</Text>
        </TouchableOpacity>

        <View style={dStyles.divider} />
        <Text style={dStyles.version}>v{APP_VERSION}</Text>
        <Text style={dStyles.status}>● Offline</Text>
      </View>
    </View>
  );
};

const MainTabs: React.FC = () => {
  const isDesktop = useIsDesktop();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrev = usePlayerStore((s) => s.skipPrev);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const navigation = useNavigation<any>();
  const progress = duration > 0 ? position / duration : 0;

  const tabNavigator = (
    <Tab.Navigator
      tabBar={
        isDesktop
          ? (props) => <DesktopSidebar {...props} />
          : (props) => <CustomTabBar {...props} />
      }
      screenOptions={{
        headerShown: false,
        // No desktop a "tab bar" vira a sidebar à esquerda.
        // O BottomTabView usa `flexDirection: row` quando a
        // posição é left/right, então a sidebar ocupa a lateral
        // e as telas ficam ao lado — em vez de ficarem embaixo.
        tabBarPosition: isDesktop ? 'left' : 'bottom',
      }}
    >
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Recents" component={RecentsScreen} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen name="Playlists" component={PlaylistsScreen} />
    </Tab.Navigator>
  );

  if (!isDesktop) {
    return tabNavigator;
  }

  return (
    <View style={mStyles.desktopShell}>
      <View style={mStyles.desktopBody}>{tabNavigator}</View>
      {currentTrack && (
        <View style={mStyles.desktopPlayerBar}>
          <MiniPlayer
            title={currentTrack.title}
            artist={currentTrack.artist}
            artwork={currentTrack.artwork}
            isPlaying={isPlaying}
            progress={progress}
            onPlayPause={isPlaying ? pause : play}
            onPrev={skipPrev}
            onNext={skipNext}
            onPress={() => navigation.navigate('PlayerScene' as never)}
            inline
          />
        </View>
      )}
    </View>
  );
};

const AppStack: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} />

    <Stack.Screen
      name="FolderDetails"
      component={FolderDetailsScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open:  TransitionSpecs.TransitionIOSSpec,
          close: TransitionSpecs.TransitionIOSSpec,
        },
      }}
    />

    <Stack.Screen
      name="PlaylistDetails"
      component={PlaylistDetailsScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open:  TransitionSpecs.TransitionIOSSpec,
          close: TransitionSpecs.TransitionIOSSpec,
        },
      }}
    />

    <Stack.Screen
      name="PlayerScene"
      component={PlayerScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        transitionSpec: {
          open: {
            animation: 'spring' as const,
            config: { stiffness: 280, damping: 30, mass: 1, overshootClamping: false, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
          },
          close: {
            animation: 'spring' as const,
            config: { stiffness: 280, damping: 30, mass: 1, overshootClamping: false, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
          },
        },
        gestureDirection: 'vertical',
        cardStyle: { backgroundColor: COLORS.bg.base },
      }}
    />

    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open:  TransitionSpecs.TransitionIOSSpec,
          close: TransitionSpecs.TransitionIOSSpec,
        },
        cardStyle: { backgroundColor: COLORS.bg.base },
      }}
    />

    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open:  TransitionSpecs.TransitionIOSSpec,
          close: TransitionSpecs.TransitionIOSSpec,
        },
        cardStyle: { backgroundColor: COLORS.bg.base },
      }}
    />
  </Stack.Navigator>
);

const dStyles = StyleSheet.create({
  sidebar: {
    width: DESKTOP_SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: COLORS.bg.elevated,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border.subtle,
    paddingBottom: SPACING.md,
    paddingHorizontal: 0,
    flexDirection: 'column',
  },
  logoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 24,
    height: 24,
    tintColor: COLORS.accent.primary,
  },
  logoText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  nav: {
    flex: 1,
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  navItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: COLORS.accent.dim,
  },
  navIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  navIndicatorActive: {
    backgroundColor: COLORS.accent.primary,
  },
  navLabel: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.secondary,
  },
  navLabelActive: {
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  bottomNav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border.subtle,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  bottomNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  bottomNavLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border.subtle,
    marginVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  version: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.tertiary,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  status: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
});

const mStyles = StyleSheet.create({
  desktopShell: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: COLORS.bg.base,
  },
  desktopBody: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopPlayerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.elevated,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer ref={navigationRef} theme={NAV_THEME}>
      <AppStack />
    </NavigationContainer>
  );
};

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg.base,
  },

  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    backgroundColor: COLORS.bg.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border.subtle,
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.touchTarget,
  },

  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.chip,
    gap: SPACING.xs,
    minWidth: SIZES.touchTarget,
  },

  tabLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent.primary,
    fontWeight: '600',
  },
});
