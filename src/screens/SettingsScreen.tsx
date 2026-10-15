import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { EqualizerSheet } from '../components/EqualizerSheet';
import { SleepTimerSheet } from '../components/SleepTimerSheet';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from '../services/notificationService';
import { formatListenedTime } from '../utils/listenedTime';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
} from '../constants/theme';

// ─── Section + Row helpers ───────────────────────────────────

const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const Row: React.FC<{
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}> = ({ label, icon, value, onPress, trailing, destructive }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
    style={styles.row}
  >
    {icon ? (
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={19}
          color={destructive ? COLORS.semantic.error : COLORS.text.secondary}
        />
      </View>
    ) : null}
    <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
      {label}
    </Text>
    {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={COLORS.text.tertiary} /> : null)}
  </TouchableOpacity>
);

// ─── Screen ──────────────────────────────────────────────────

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const listenedSeconds = usePlayerStore((s) => s.listenedSeconds);
  const resetListenedSeconds = usePlayerStore((s) => s.resetListenedSeconds);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const sleepTimerEnd = usePlayerStore((s) => s.sleepTimerEnd);

  const rescanMusic = useLibraryStore((s) => s.rescanMusic);

  const [notificationsOn, setNotificationsOn] = useState(true);
  const [showEq, setShowEq] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);

  useEffect(() => {
    getNotificationsEnabled().then(setNotificationsOn);
  }, []);

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      setNotificationsOn(true);
      await setNotificationsEnabled(true);
    } else {
      setNotificationsOn(false);
      await setNotificationsEnabled(false);
      Alert.alert(
        'Notificações desativadas',
        'Você pode reativar a qualquer momento em Configurações.',
      );
    }
  };

  const handleResetListening = () => {
    Alert.alert(
      'Zerar tempo escutado',
      'Isso não pode ser desfeito. Zerar o contador?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Zerar',
          style: 'destructive',
          onPress: () => resetListenedSeconds(),
        },
      ],
    );
  };

  const handleRescan = () => {
    Alert.alert(
      'Recuperar músicas',
      'Varrer o armazenamento do app em busca de músicas salvas no aparelho?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Varrer',
          onPress: async () => {
            const count = await rescanMusic();
            if (count > 0) {
              Alert.alert(
                'Concluído',
                `${count} música${count === 1 ? '' : 's'} recuperada${count === 1 ? '' : 's'} com sucesso.`,
              );
            } else {
              Alert.alert(
                'Nada encontrado',
                'Nenhuma música nova encontrada no armazenamento do app.',
              );
            }
          },
        },
      ],
    );
  };

  const sleepStatus = sleepTimerEnd
    ? `Restam ${Math.ceil((sleepTimerEnd - Date.now()) / 60000)} min`
    : 'Desativado';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      {/* ── Back button ── */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: insets.top + SPACING.sm }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={30} color={COLORS.text.primary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING['2xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Configurações</Text>

        {/* ── Conta ── */}
        <SectionLabel>CONTA</SectionLabel>
        <View style={styles.group}>
          <Row
            label="Perfil"
            icon="person-circle-outline"
            value="Ver perfil"
            onPress={() => navigation.navigate('Profile')}
          />
        </View>

        {/* ── Reprodução ── */}
        <SectionLabel>REPRODUÇÃO</SectionLabel>
        <View style={styles.group}>
          <Row
            label="Tempo total escutado"
            icon="time-outline"
            value={formatListenedTime(listenedSeconds)}
            onPress={handleResetListening}
          />
          <Row label="Equalizador" icon="options-outline" onPress={() => setShowEq(true)} />
          <Row
            label="Timer (sleep)"
            icon="moon-outline"
            value={sleepStatus}
            onPress={() => setShowSleepTimer(true)}
          />
          <Row
            label="Embaralhar"
            icon="shuffle-outline"
            trailing={
              <Switch
                value={shuffleEnabled}
                onValueChange={toggleShuffle}
                trackColor={{ true: COLORS.accent.dim, false: COLORS.border.strong }}
                thumbColor={shuffleEnabled ? COLORS.accent.primary : COLORS.text.disabled}
              />
            }
          />
        </View>

        {/* ── Biblioteca ── */}
        <SectionLabel>BIBLIOTECA</SectionLabel>
        <View style={styles.group}>
          <Row
            label="Recuperar músicas do aparelho"
            icon="refresh-outline"
            onPress={handleRescan}
          />
        </View>

        {/* ── Preferências ── */}
        <SectionLabel>PREFERÊNCIAS</SectionLabel>
        <View style={styles.group}>
          <Row
            label="Notificações"
            icon="notifications-outline"
            trailing={
              <Switch
                value={notificationsOn}
                onValueChange={handleToggleNotifications}
                trackColor={{ true: COLORS.accent.dim, false: COLORS.border.strong }}
                thumbColor={notificationsOn ? COLORS.accent.primary : COLORS.text.disabled}
              />
            }
          />
        </View>

        {/* ── Sobre ── */}
        <SectionLabel>SOBRE</SectionLabel>
        <View style={styles.group}>
          <Row label="Versão" icon="information-circle-outline" value={Constants.expoConfig?.version ?? '1.0.0'} />
        </View>

        {/* ── Sign out ── */}

      </ScrollView>

      <EqualizerSheet visible={showEq} onClose={() => setShowEq(false)} />
      <SleepTimerSheet visible={showSleepTimer} onClose={() => setShowSleepTimer(false)} />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg.base,
  },
  scroll: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: SPACING.sm,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING['3xl'],
  },
  pageTitle: {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  sectionLabel: {
    ...TYPOGRAPHY.overline,
    color: COLORS.text.tertiary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  group: {
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border.subtle,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bg.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rowLabel: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
    flex: 1,
  },
  rowLabelDestructive: {
    color: COLORS.semantic.error,
    fontWeight: '600',
  },
  rowValue: {
    ...TYPOGRAPHY.numeric,
    color: COLORS.text.secondary,
    maxWidth: '50%',
    textAlign: 'right',
  },

  signOutButton: {
    marginTop: SPACING['2xl'],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.semantic.errorMuted,
    alignItems: 'center',
  },
  signOutText: {
    ...TYPOGRAPHY.title,
    color: COLORS.semantic.error,
    fontWeight: '600',
  },
});
