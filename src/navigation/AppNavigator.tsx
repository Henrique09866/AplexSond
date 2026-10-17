import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Platform,
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

const DesktopSidebar: React.FC<any> = (props) => {
  const { state, navigation } = props;
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

  return (
    <View style={dStyles.sidebar}>
      <View style={dStyles.logoBlock}>
        <Text style={dStyles.logoText}>AplexSond</Text>
      </View>

      <View style={dStyles.nav}>
        {TABS.map((tab, index) => {
          const focused = activeIndex === index;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handlePress(index)}
              style={[dStyles.navItem, focused && dStyles.navItemActive]}
            >
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={22}
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

      <View style={dStyles.bottomNav}>
        <TouchableOpacity
          style={dStyles.bottomNavItem}
          onPress={() => navigation.navigate('Profile' as never)}
        >
          <Ionicons name="person-circle-outline" size={20} color={COLORS.text.secondary} />
          <Text style={dStyles.bottomNavLabel}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={dStyles.bottomNavItem}
          onPress={() => navigation.navigate('Settings' as never)}
        >
          <Ionicons name="settings-outline" size={20} color={COLORS.text.secondary} />
          <Text style={dStyles.bottomNavLabel}>Configurações</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const MainTabs: React.FC = () => {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

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
        tabBarStyle: isDesktop ? { width: 240, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: COLORS.border.subtle } : undefined,
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
    width: 240,
    height: '100%',
    backgroundColor: COLORS.bg.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border.subtle,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'column',
  },
  logoBlock: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  logoText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.accent.primary,
    fontWeight: '700',
  },
  nav: {
    flex: 1,
    gap: SPACING.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  navItemActive: {
    backgroundColor: COLORS.accent.muted,
  },
  navLabel: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.secondary,
  },
  navLabelActive: {
    color: COLORS.accent.primary,
    fontWeight: '600',
  },
  bottomNav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border.subtle,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  bottomNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  bottomNavLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
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
    height: 88,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border.subtle,
    backgroundColor: COLORS.bg.base,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
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
