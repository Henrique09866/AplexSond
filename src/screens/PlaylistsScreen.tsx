import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Pressable,
  StyleSheet,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Playlist, useLibraryStore, usePlaylistsStore } from '../store';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SHADOWS,
  SIZES,
} from '../constants/theme';

// ─── Create playlist modal ────────────────────────────────────

const CreateModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}> = ({ visible, onClose, onCreate }) => {
  const insets     = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const translateY = useRef(new Animated.Value(300)).current;
  const backdrop   = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setName('');
      setError('');
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 60, friction: 14, useNativeDriver: true }),
        Animated.timing(backdrop,   { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop,   { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [backdrop, translateY, visible]);

  const handleCreate = () => {
    if (!name.trim()) { setError('Dê um nome para a playlist'); return; }
    onCreate(name.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.black, opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[modalStyles.sheet, { paddingBottom: insets.bottom + SPACING.lg, transform: [{ translateY }] }]}>
          <View style={modalStyles.handleRow}>
            <View style={modalStyles.handle} />
          </View>

          <Text style={modalStyles.title}>Nova playlist</Text>

          <TextInput
            style={[modalStyles.input, error ? modalStyles.inputError : null]}
            placeholder="Nome da playlist"
            placeholderTextColor={COLORS.text.tertiary}
            value={name}
            onChangeText={(t) => { setName(t); setError(''); }}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          {error ? <Text style={modalStyles.errorText}>{error}</Text> : null}

          <View style={modalStyles.actions}>
            <PrimaryButton label="Cancelar" onPress={onClose} variant="ghost" size="md" style={{ flex: 1 }} />
            <PrimaryButton label="Criar" onPress={handleCreate} variant="primary" size="md" style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bg.overlay,
    borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
    ...SHADOWS.float,
  },
  handleRow: { alignItems: 'center', paddingBottom: SPACING.xs },
  handle: { width: SIZES.sheet.handleWidth, height: SIZES.sheet.handleHeight, borderRadius: 2, backgroundColor: COLORS.border.strong },
  title: { ...TYPOGRAPHY.h3 },
  input: {
    backgroundColor: COLORS.bg.input, borderRadius: RADIUS.input,
    paddingHorizontal: SPACING.md, height: 48,
    ...TYPOGRAPHY.body, color: COLORS.text.primary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border.default,
  },
  inputError: { borderColor: COLORS.semantic.error },
  errorText:  { ...TYPOGRAPHY.caption, color: COLORS.semantic.error },
  actions:    { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
});

// ─── Playlist row ─────────────────────────────────────────────

const PlaylistRow: React.FC<{
  playlist: Playlist;
  coverUri?: string | null;
  trackCount: number;
  onPress: () => void;
}> = ({ playlist, coverUri, trackCount, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, tension: 80, friction: 12, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    tension: 80, friction: 12, useNativeDriver: true }).start()}
        activeOpacity={1}
        style={rowStyles.container}
      >
        <View style={rowStyles.cover}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={rowStyles.coverImage} />
          ) : (
            <View style={rowStyles.coverFallback}>
              <Ionicons name="musical-notes" size={26} color={COLORS.text.tertiary} />
            </View>
          )}
        </View>

        <View style={rowStyles.info}>
          <Text style={rowStyles.name} numberOfLines={1}>{playlist.name}</Text>
          <Text style={rowStyles.count}>
            {trackCount} {trackCount === 1 ? 'música' : 'músicas'}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color={COLORS.text.tertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING.listItemPaddingV,
  },
  cover: { width: SIZES.cover.lg, height: SIZES.cover.lg, borderRadius: RADIUS.coverMedium, overflow: 'hidden', marginRight: SPACING.md, flexShrink: 0 },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { flex: 1, backgroundColor: COLORS.bg.highlight, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  name: { ...TYPOGRAPHY.titleLarge },
  count: { ...TYPOGRAPHY.caption, color: COLORS.text.secondary },
});

// ─── Screen ───────────────────────────────────────────────────

export const PlaylistsScreen: React.FC = () => {
  const insets      = useSafeAreaInsets();
  const navigation  = useNavigation<any>();
  const playlists   = usePlaylistsStore((s) => s.playlists);
  const hydrated    = usePlaylistsStore((s) => s.hydrated);
  const hydrate     = usePlaylistsStore((s) => s.hydrate);
  const createPlaylist = usePlaylistsStore((s) => s.createPlaylist);
  const tracks      = useLibraryStore((s) => s.tracks);
  const [showCreate, setShowCreate] = useState(false);

  React.useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const getFirstCover = useCallback(
    (playlist: Playlist) => {
      const firstId  = playlist.trackIds[0];
      const track    = tracks.find((t) => t.id === firstId);
      return track?.artwork ?? null;
    },
    [tracks],
  );

  const keyExtractor = useCallback((item: Playlist) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <PlaylistRow
        playlist={item}
        coverUri={getFirstCover(item)}
        trackCount={item.trackIds.length}
        onPress={() =>
          navigation.navigate('PlaylistDetails' as never, {
            playlistId:   item.id,
            playlistName: item.name,
          } as never)
        }
      />
    ),
    [getFirstCover, navigation],
  );

  const ListHeader = (
    <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
      <Text style={styles.pageTitle}>Playlists</Text>
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        style={styles.createButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.buttonContent}>
          <Ionicons name="add" size={18} color={COLORS.text.onAccent} />
          <Text style={styles.createButtonText}>Nova playlist</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg.base} />

      <FlatList
        data={playlists}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            icon="list-outline"
            title="Nenhuma playlist ainda"
            subtitle='Toque em "+ Nova" para criar sua primeira playlist'
          />
        }
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              insets.bottom +
              SPACING.tabBarHeight +
              SIZES.miniPlayerHeight +
              SPACING.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      />

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(name) => createPlaylist(name)}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg.base },
  list:   { flexGrow: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.xl,
  },
  pageTitle:         { ...TYPOGRAPHY.h1 },
  createButton:      { backgroundColor: COLORS.accent.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.chip, ...SHADOWS.accentGlow },
  createButtonText:  { ...TYPOGRAPHY.label, color: COLORS.text.onAccent, fontWeight: '700' },
  buttonContent:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
});
