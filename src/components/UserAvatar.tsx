import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { AvatarCrop } from '../core/entities';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

interface UserAvatarProps {
  photoURL?: string | null;
  initial: string;
  size?: number;
  crop?: AvatarCrop | null;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Avatar circular que aplica o corte (zoom/posição) salvo no perfil,
 * com fallback para a inicial quando não há foto.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  initial,
  size = 40,
  crop,
  style,
}) => {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          resizeMode="cover"
          style={[
            styles.photo,
            {
              width: size,
              height: size,
              transform: crop
                ? [
                    { scale: crop.scale },
                    { translateX: crop.tx * size },
                    { translateY: crop.ty * size },
                  ]
                : undefined,
            },
          ]}
        />
      ) : (
        <Image
          source={require('../../assets/images/logoaplexsond.png')}
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: COLORS.accent.muted,
  },
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  placeholder: {
    backgroundColor: COLORS.accent.muted,
    borderWidth: 2,
    borderColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    ...TYPOGRAPHY.title,
    color: COLORS.accent.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
});
