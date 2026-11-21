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

import { SleepTimerSheet } from '../components/SleepTimerSheet';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useFoldersStore } from '../store/useFoldersStore';
import { usePlaylistsStore } from '../store/usePlaylistsStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const tracks = useLibraryStore((s) => s.tracks);
  const folders = useFoldersStore((s) => s.folders);
  const playlists = usePlaylistsStore((s) => s.playlists);

  const [notificationsOn, setNotificationsOn] = useState(true);

  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const tracks = useLibraryStore.getState().tracks;
      const folders = useFoldersStore.getState().folders;
      const playlists = usePlaylistsStore.getState().playlists;
      const payload = {
        version: 1,
        exportedAt: Date.now(),
        tracks,
        folders,
        playlists,
      };
      const path = `${FileSystem.documentDirectory}sondlize-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json' });
      } else {
        Alert.alert('Backup criado', `Arquivo salvo em:\n${path}`);
      }
    } catch (e: any) {
      Alert.alert('Erro no backup', e?.message ?? 'Falha ao criar backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const data = JSON.parse(content);
      if (!data || !Array.isArray(data.tracks)) {
        Alert.alert('Backup inválido', 'O arquivo não parece ser um backup do SondLize.');
        return;
      }
      Alert.alert(
        'Restaurar backup',
        `Isso substituirá sua biblioteca atual por ${data.tracks.length} músicas, ${data.folders?.length ?? 0} pastas e ${data.playlists?.length ?? 0} playlists. Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              try {
                await AsyncStorage.setItem('@sondlize:library', JSON.stringify(data.tracks ?? []));
                await AsyncStorage.setItem('@sondlize:folders', JSON.stringify(data.folders ?? []));
                await AsyncStorage.setItem('@sondlize:playlists', JSON.stringify(data.playlists ?? []));
                await useLibraryStore.getState().loadTracks();
                await useFoldersStore.getState().load();
                await usePlaylistsStore.getState().hydrate();
                Alert.alert('Restaurado', 'Backup restaurado com sucesso.');
              } catch (e: any) {
                Alert.alert('Erro ao restaurar', e?.message ?? 'Falha na restauração.');
              }
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao selecionar arquivo.');
    }
  };

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

        {/* ── Estatísticas ── */}
        <SectionLabel>ESTATÍSTICAS</SectionLabel>
        <View style={styles.group}>
          <Row label="Músicas" icon="musical-notes-outline" value={String(tracks.length)} />
          <Row label="Pastas" icon="folder-outline" value={String(folders.length)} />
          <Row label="Playlists" icon="list-outline" value={String(playlists.length)} />
          <Row
            label="Já tocadas"
            icon="play-circle-outline"
            value={String(tracks.filter((t) => !!t.lastPlayedAt).length)}
          />
        </View>

        {/* ── Dados ── */}
        <SectionLabel>DADOS</SectionLabel>
        <View style={styles.group}>
          <Row
            label="Fazer backup"
            icon="cloud-upload-outline"
            value={backupLoading ? 'Gerando…' : 'Exportar biblioteca'}
            onPress={backupLoading ? undefined : handleBackup}
          />
          <Row
            label="Restaurar backup"
            icon="cloud-download-outline"
            value="Importar arquivo JSON"
            onPress={handleRestore}
          />
        </View>

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
                trackColor={{ true: COLORS.accent.muted, false: COLORS.border.strong }}
                thumbColor={shuffleEnabled ? COLORS.accent.primary : COLORS.text.disabled}
                ios_backgroundColor={COLORS.border.strong}
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
                trackColor={{ true: COLORS.accent.muted, false: COLORS.border.strong }}
                thumbColor={notificationsOn ? COLORS.accent.primary : COLORS.text.disabled}
                ios_backgroundColor={COLORS.border.strong}
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
    backgroundColor: COLORS.accent.muted,
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
