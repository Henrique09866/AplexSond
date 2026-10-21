import React from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action }) => {
  const appear = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [appear, pulse]);

  const translateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: appear, transform: [{ translateY }] }]}>
      {icon ? (
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulse }] }]}>
          <Ionicons name={icon} size={34} color={COLORS.accent.primary} />
        </Animated.View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.actionWrapper}>{action}</View> : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING['3xl'],
    gap: SPACING.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.accentGlow,
  },
  title: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    color: COLORS.text.secondary,
  },
  actionWrapper: {
    marginTop: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
});
