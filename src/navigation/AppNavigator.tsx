import React from 'react';
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
} from '@react-navigation/bottom-tabs';
import { navigationRef } from './navigationRef';

import {
  LibraryScreen,
  RecentsScreen,
  PlaylistsScreen,
  PlaylistDetailsScreen,
  FoldersScreen,
  FolderDetailsScreen,
  PlayerScreen,
  SettingsScreen,
} from '../screens';
import { GlassTabBar } from '../components/GlassTabBar';
import { COLORS } from '../constants/theme';

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

// (Tab definitions moved to GlassTabBar component)

// ─── Navigators ───────────────────────────────────────────────

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const MainTabs: React.FC = () => {
  const tabNavigator = (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Recents" component={RecentsScreen} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen name="Playlists" component={PlaylistsScreen} />
    </Tab.Navigator>
  );

  return tabNavigator;
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

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer ref={navigationRef} theme={NAV_THEME}>
      <AppStack />
    </NavigationContainer>
  );
};

// (styles removed — now in GlassTabBar)
