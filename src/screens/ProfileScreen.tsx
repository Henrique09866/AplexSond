import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { UserAvatar } from '../components/UserAvatar';
import { AvatarCropModal } from '../components/AvatarCropModal';
import { useAuthStore } from '../store/useAuthStore';
import { AvatarCrop } from '../core/entities';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SIZES,
  SHADOWS,
} from '../constants/theme';

const AVATAR_SIZE = 96;

interface PendingCrop {
  uri: string;
  isNew: boolean;
  initialCrop?: AvatarCrop | null;
}

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const profile = useAuthStore((s) => s.profile);
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);

  const [uploading, setUploading] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);

  const displayName = profile?.displayName || 'AplexSond';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A';

  // ── Trocar foto (escolhe e abre o ajuste) ──
  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permissão negada',
          'Permita o acesso às fotos nas configurações para escolher uma imagem.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      setPendingCrop({ uri: result.assets[0].uri, isNew: true, initialCrop: null });
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível selecionar a foto.');
    }
  };

  // ── Reajustar foto atual ──
  const handleAdjustAvatar = () => {
    if (!profile?.photoURL) {
      handlePickAvatar();
      return;
    }
    setPendingCrop({ uri: profile.photoURL, isNew: false, initialCrop: profile.crop });
  };

  // ── Confirma o corte ──
  const handleCropConfirm = async (crop: AvatarCrop) => {
    if (!pendingCrop) return;
    setUploading(true);
    try {
      if (pendingCrop.isNew) {
        await uploadAvatar(pendingCrop.uri);
      }
      await saveProfile({ crop });
      Alert.alert('Foto atualizada', 'Sua foto de perfil foi salva.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a foto.');
    } finally {
      setUploading(false);
      setPendingCrop(null);
    }
  };

  // ── Editar nome ──
  const handleSaveName = async (name: string) => {
    if (!name.trim()) return;
    try {
      await saveProfile({ displayName: name.trim() });
      Alert.alert('Perfil atualizado', 'Seu nome foi salvo.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o nome.');
    }
  };

  // ── Sair ──
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

      <View style={[styles.content, { paddingTop: insets.top + SPACING['2xl'] }]}>
        <Text style={styles.pageTitle}>Perfil</Text>

        {/* ── Avatar ── */}
        <TouchableOpacity
          onPress={handleAdjustAvatar}
          disabled={uploading}
          activeOpacity={0.8}
          style={styles.avatarWrap}
        >
          <UserAvatar
            photoURL={profile?.photoURL}
            initial={initial}
            size={AVATAR_SIZE}
            crop={profile?.crop}
          />

          <View style={styles.avatarEditBadge}>
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.black} />
            ) : (
              <Ionicons name="camera" size={15} color={COLORS.black} />
            )}
          </View>
        </TouchableOpacity>

        {/* ── Info ── */}
        <Text style={styles.name}>{displayName || 'AplexSond'}</Text>

        <TouchableOpacity
          onPress={() => setShowNameModal(true)}
          style={styles.editNameButton}
        >
          <Text style={styles.editNameText}>Editar nome</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePickAvatar}
          disabled={uploading}
          style={styles.ghostButton}
        >
          <Text style={styles.ghostButtonText}>
            {profile?.photoURL ? 'Trocar foto de perfil' : 'Adicionar foto'}
          </Text>
        </TouchableOpacity>

        {profile?.photoURL ? (
          <TouchableOpacity
            onPress={handleAdjustAvatar}
            disabled={uploading}
            style={styles.ghostButtonSecondary}
          >
            <Text style={styles.ghostButtonSecondaryText}>Ajustar foto</Text>
          </TouchableOpacity>
        ) : null}

        {/* ── Settings entry ── */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsRow}
        >
          <View style={styles.settingsIconCircle}>
            <Ionicons name="settings-outline" size={20} color={COLORS.accent.primary} />
          </View>
          <View style={styles.settingsInfo}>
            <Text style={styles.settingsLabel}>Configurações</Text>
            <Text style={styles.settingsSub}>Conta, reprodução e preferências</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.text.tertiary} />
        </TouchableOpacity>

        {/* ── Sign out ── */}

      </View>

      {/* ── Edit name modal ── */}
      <EditNameModal
        visible={showNameModal}
        currentName={displayName}
        onClose={() => setShowNameModal(false)}
        onSave={handleSaveName}
      />

      {/* ── Avatar crop modal ── */}
      <AvatarCropModal
        visible={!!pendingCrop}
        uri={pendingCrop?.uri ?? null}
        initialCrop={pendingCrop?.initialCrop}
        onClose={() => setPendingCrop(null)}
        onConfirm={handleCropConfirm}
      />
    </View>
  );
};

// ─── Edit name modal ─────────────────────────────────────────

const EditNameModal: React.FC<{
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}> = ({ visible, currentName, onClose, onSave }) => {
  const [name, setName] = useState(currentName);
  const translateY = useRef(new Animated.Value(300)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 60, friction: 14, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [backdrop, currentName, translateY, visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.black, opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.modalSheet, { transform: [{ translateY }] }]}>
          <View style={styles.modalHandleRow}>
            <View style={styles.modalHandle} />
          </View>

          <Text style={styles.modalTitle}>Editar nome</Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Seu nome"
            placeholderTextColor={COLORS.text.tertiary}
            value={name}
            onChangeText={setName}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.modalButtonsRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.modalButton, styles.modalButtonGhost]}
            >
              <Text style={styles.modalButtonGhostText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.modalButton, styles.modalButtonPrimary]}
            >
              <Text style={styles.modalButtonPrimaryText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg.base,
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
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
  },
  pageTitle: {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  // ── Avatar ──
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.bg.base,
    ...SHADOWS.accentGlow,
  },

  // ── Info ──
  name: {
    ...TYPOGRAPHY.h2,
    textAlign: 'center',
  },
  email: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  editNameButton: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  editNameText: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent.primary,
    fontWeight: '700',
  },
  ghostButton: {
    alignSelf: 'center',
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent.muted,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.chip,
  },
  ghostButtonText: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent.primary,
    fontWeight: '700',
  },
  ghostButtonSecondary: {
    alignSelf: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  ghostButtonSecondaryText: {
    ...TYPOGRAPHY.label,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },

  // ── Settings entry ──
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING['2xl'],
    gap: SPACING.md,
  },
  settingsIconCircle: {
    width: SIZES.button.iconButton,
    height: SIZES.button.iconButton,
    borderRadius: SIZES.button.iconButton / 2,
    backgroundColor: COLORS.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  settingsInfo: {
    flex: 1,
    gap: 2,
  },
  settingsSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
  },

  // ── Sign out ──
  signOutButton: {
    marginTop: SPACING.lg,
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

  // ── Modal ──
  modalSheet: {
    backgroundColor: COLORS.bg.overlay,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING['2xl'],
  },
  modalHandleRow: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border.strong,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalInput: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.bg.input,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border.default,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonGhost: {
    backgroundColor: COLORS.bg.highlight,
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.accent.primary,
  },
  modalButtonGhostText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.secondary,
  },
  modalButtonPrimaryText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.onAccent,
    fontWeight: '700',
  },
});
