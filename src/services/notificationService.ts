import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = '@sondlize:notificationsEnabled';

/**
 * Solicita permissão de notificação (obrigatório Android 13+ / API 33+).
 *
 * A notificação de mídia em si (com botões de ícones e capa) é gerenciada
 * nativamente pelo @rntp/player (MediaSession), não pelo expo-notifications.
 *
 * Deve ser chamada UMA vez na inicialização do app (App.tsx).
 */
export async function setupNotifications(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/** Preferência do usuário sobre notificações (default: habilitado). */
export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PREFS_KEY);
    return value !== 'false';
  } catch {
    return true;
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, String(enabled));
}
