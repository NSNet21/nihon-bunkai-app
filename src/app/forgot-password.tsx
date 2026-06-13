import { useRouter } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiAlertCircle, FiMail } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useThemePalette } from '@/context/theme';
import { normalizeLoginEmail } from '@/lib/login-validation';

type Phase = 'idle' | 'sending' | 'sent' | 'error';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const screenEntry = useSharedValue(0);

  useEffect(() => {
    screenEntry.value = withTiming(1, { duration: 210, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [screenEntry]);

  const screenEntryStyle = useAnimatedStyle(() => ({
    opacity: screenEntry.value,
    transform: [{ translateX: (1 - screenEntry.value) * 14 }],
  }));

  function validateEmail() {
    const result = normalizeLoginEmail(email);
    if (!result.ok) {
      setMessage(result.message);
      setPhase('error');
      return null;
    }
    return result.value;
  }

  async function onRequestReset() {
    const targetEmail = validateEmail();
    if (!targetEmail) return;
    setPhase('sending');
    setMessage(null);
    const { error } = await requestPasswordReset(targetEmail);
    if (error) {
      setMessage(error);
      setPhase('error');
      return;
    }
    setMessage(`ถ้าอีเมลนี้มีบัญชีอยู่ เราจะส่งลิงก์รีเซ็ตไปที่ ${targetEmail}`);
    setPhase('sent');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, screenEntryStyle]}>
          <View style={styles.hero}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              PASSWORD · 日本分解
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              รีเซ็ตรหัสผ่าน
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              กรอกอีเมลที่สมัครไว้ เพื่อรับลิงก์ตั้งรหัสผ่านใหม่
            </ThemedText>
          </View>

          <WebForm onSubmit={onRequestReset}>
            <View style={styles.form}>
              <EmailField
                value={email}
                onChange={(t) => {
                  setEmail(t);
                  if (phase === 'error') setPhase('idle');
                }}
                disabled={phase === 'sending'}
                invalid={phase === 'error'}
              />
              {message ? <StatusMessage tone={phase === 'error' ? 'error' : 'info'} message={message} /> : null}
              <PrimaryButton
                onPress={onRequestReset}
                disabled={phase === 'sending'}
                label={phase === 'sending' ? 'กำลังส่งลิงก์…' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
              />
              <Pressable onPress={() => router.replace('/login')} style={styles.secondaryLink}>
                <ThemedText type="small" style={{ color: Accent.base }}>
                  กลับหน้าเข้าสู่ระบบ
                </ThemedText>
              </Pressable>
            </View>
          </WebForm>

          <Pressable onPress={() => router.replace('/')} style={styles.cancel}>
            <ThemedText type="small" themeColor="textSecondary">
              ← กลับ Browse
            </ThemedText>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </ThemedView>
  );
}

function WebForm({ onSubmit, children }: { onSubmit: () => void; children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return createElement(
    'form',
    {
      onSubmit: (e: any) => { e.preventDefault(); onSubmit(); },
      style: { display: 'contents' },
    },
    children,
    createElement('button', {
      key: 'submit',
      type: 'submit',
      style: { display: 'none' },
      'aria-hidden': true,
      tabIndex: -1,
    }),
  );
}

function EmailField({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (s: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[
      styles.inputWrap,
      {
        borderBottomColor: invalid ? Accent.base : focused ? Accent.base : colors.border,
        backgroundColor: invalid ? Accent.bg : 'transparent',
      },
    ]}>
      <FiMail size={16} color={invalid || focused ? Accent.base : colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="อีเมลของคุณ"
        placeholderTextColor={colors.textHint}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="อีเมล"
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

function StatusMessage({ tone, message }: { tone: 'error' | 'info'; message: string }) {
  const colors = useThemePalette();
  const color = tone === 'error' ? Accent.base : colors.textSecondary;
  return (
    <View style={[styles.statusMessage, { borderColor: tone === 'error' ? Accent.soft : colors.border, backgroundColor: tone === 'error' ? Accent.bg : colors.backgroundElement }]}>
      {tone === 'error' ? <FiAlertCircle size={14} color={Accent.base} /> : null}
      <ThemedText type="small" style={{ color, flex: 1 }}>
        {message}
      </ThemedText>
    </View>
  );
}

function PrimaryButton({ onPress, disabled, label }: { onPress: () => void; disabled?: boolean; label: string }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { scale.value = withTiming(0.96, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 180, easing: Easing.bezier(0.2, 0, 0, 1) }); }}
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: Accent.base, opacity: disabled ? 0.6 : pressed ? 0.88 : 1 }]}>
        <ThemedText type="defaultSemiBold" style={styles.primaryBtnLabel}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: 440 },
  content: { flex: 1, padding: Spacing.four, gap: Spacing.four, justifyContent: 'center' },
  hero: { gap: Spacing.two },
  eyebrow: { letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 32 },
  form: { gap: Spacing.four },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: 1, paddingHorizontal: 0, paddingVertical: Spacing.three },
  input: { flex: 1, fontSize: 16, outlineStyle: 'none' as any },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  primaryBtn: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Radii.sm, alignItems: 'center' },
  primaryBtnLabel: { color: '#fff' },
  secondaryLink: { alignItems: 'center', paddingVertical: Spacing.two },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three },
});
