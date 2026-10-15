import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';

export const LoginScreen: React.FC = () => {
  const intro = useRef(new Animated.Value(0)).current;
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuthStore();

  React.useEffect(() => {
    Animated.spring(intro, {
      toValue: 1,
      tension: 55,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [intro]);

  const logoScale = intro.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const logoTranslate = intro.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não conferem.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e: any) {
      const msg =
        e?.code === 'auth/user-not-found'
          ? 'Usuário não encontrado.'
          : e?.code === 'auth/wrong-password'
            ? 'Senha incorreta.'
            : e?.code === 'auth/email-already-in-use'
              ? 'Este email já está cadastrado.'
              : e?.code === 'auth/invalid-credential'
                ? 'Email ou senha inválidos.'
                : e?.message ?? 'Erro desconhecido.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.brandBlock,
            {
              opacity: intro,
              transform: [{ translateY: logoTranslate }, { scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoGlow} />
          <View style={styles.logoFrame}>
            <Image
              source={require('../../assets/images/logoaplexsond.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brandName}>SondLize</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Crie sua conta' : 'Entre para ouvir suas músicas'}
          </Text>
        </Animated.View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.text.tertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={COLORS.text.tertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Confirmar senha"
            placeholderTextColor={COLORS.text.tertiary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Cadastrar' : 'Entrar'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsSignUp(!isSignUp);
            setConfirmPassword('');
          }}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {isSignUp
              ? 'Já tem conta? Entrar'
              : 'Não tem conta? Cadastre-se'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.base,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoGlow: {
    position: 'absolute',
    top: 8,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: COLORS.accent.glow,
    transform: [{ scale: 1.25 }],
  },
  logoFrame: {
    width: 118,
    height: 118,
    borderRadius: 59,
    padding: 8,
    backgroundColor: COLORS.bg.surface,
    borderWidth: 1,
    borderColor: COLORS.border.strong,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 51,
  },
  brandName: {
    ...TYPOGRAPHY.display,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.bg.input,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border.default,
  },
  button: {
    backgroundColor: COLORS.accent.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZES.button.heightMd,
    marginTop: SPACING.sm,
  },
  buttonText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text.inverse,
    fontWeight: '700',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  toggleText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
  },
});
