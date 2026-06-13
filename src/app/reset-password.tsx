import { useRouter } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiAlertCircle, FiCheck, FiEye, FiEyeOff, FiLock } from 'react-icons/fi';
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
import {
  getPasswordRequirementState,
  validateLaunchPassword,
  type PasswordRequirementId,
} from '@/lib/login-validation';

type Phase = 'idle' | 'saving' | 'saved' | 'error';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const screenEntry = useSharedValue(0);

  useEffect(() => {
    screenEntry.value = withTiming(1, { duration: 210, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [screenEntry]);

  const screenEntryStyle = useAnimatedStyle(() => ({
    opacity: screenEntry.value,
    transform: [{ translateX: (1 - screenEntry.value) * -14 }],
  }));

  async function onUpdatePassword() {
    const passwordResult = validateLaunchPassword(password);
    if (!passwordResult.ok) {
      setMessage(passwordResult.message);
      setPhase('error');
      return;
    }
    setPhase('saving');
    setMessage(null);
    const { error } = await updatePassword(password);
    if (error) {
      setMessage('ลิงก์รีเซ็ตอาจหมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง');
      setPhase('error');
      return;
    }
    setPassword('');
    setMessage('ตั้งรหัสผ่านใหม่แล้ว');
    setPhase('saved');
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
              ตั้งรหัสผ่านใหม่
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ใช้รหัสผ่านใหม่สำหรับเข้าสู่ระบบ Companion App
            </ThemedText>
          </View>

          {phase === 'saved' ? (
            <ThemedView type="backgroundElement" style={styles.successCard}>
              <ThemedText type="defaultSemiBold">{message ?? 'ตั้งรหัสผ่านใหม่แล้ว'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ตอนนี้บัญชีนี้เข้าสู่ระบบอยู่แล้ว คุณสามารถกลับไป Browse และใช้งานต่อได้ทันที
              </ThemedText>
              <PrimaryButton onPress={() => router.replace('/')} label="กลับ Browse" />
            </ThemedView>
          ) : (
            <WebForm onSubmit={onUpdatePassword}>
              <View style={styles.form}>
                <PasswordField
                  value={password}
                  onChange={(t) => {
                    setPassword(t);
                    if (phase === 'error') setPhase('idle');
                  }}
                  disabled={phase === 'saving'}
                  invalid={phase === 'error'}
                  visible={passwordVisible}
                  onToggleVisible={() => setPasswordVisible((v) => !v)}
                />
                <PasswordRequirements password={password} />
                {message ? <StatusMessage tone={phase === 'error' ? 'error' : 'info'} message={message} /> : null}
                <PrimaryButton
                  onPress={onUpdatePassword}
                  disabled={phase === 'saving'}
                  label={phase === 'saving' ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
                />
                <Pressable onPress={() => router.replace('/forgot-password')} style={styles.secondaryLink}>
                  <ThemedText type="small" style={{ color: Accent.base }}>
                    ขอลิงก์รีเซ็ตใหม่
                  </ThemedText>
                </Pressable>
              </View>
            </WebForm>
          )}
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

function PasswordField({
  value,
  onChange,
  disabled,
  invalid,
  visible,
  onToggleVisible,
}: {
  value: string;
  onChange: (s: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  const RevealIcon = visible ? FiEyeOff : FiEye;
  return (
    <View style={[
      styles.inputWrap,
      {
        borderBottomColor: invalid ? Accent.base : focused ? Accent.base : colors.border,
        backgroundColor: invalid ? Accent.bg : 'transparent',
      },
    ]}>
      <FiLock size={16} color={invalid || focused ? Accent.base : colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="รหัสผ่านใหม่"
        placeholderTextColor={colors.textHint}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="รหัสผ่านใหม่"
        style={[styles.input, { color: colors.text }]}
      />
      <Pressable
        onPress={onToggleVisible}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        hitSlop={8}
        style={({ pressed }) => [
          styles.passwordReveal,
          pressed && { opacity: 0.7 },
          disabled && { opacity: 0.5 },
        ]}>
        <RevealIcon size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const colors = useThemePalette();
  const state = getPasswordRequirementState(password);
  const items: { id: PasswordRequirementId; label: string }[] = [
    { id: 'length', label: '8+ ตัวอักษร' },
    { id: 'letter', label: 'ตัวอักษร' },
    { id: 'number', label: 'ตัวเลข' },
    { id: 'special', label: 'สัญลักษณ์' },
  ];

  return (
    <View style={styles.requirementsLine} accessibilityLabel="เงื่อนไขรหัสผ่านใหม่">
      <View style={styles.requirementsHeader}>
        <FiLock size={13} color={Accent.base} />
        <ThemedText type="small" themeColor="textSecondary">
          เงื่อนไขรหัสผ่าน:
        </ThemedText>
      </View>
      <View style={styles.requirementList}>
        {items.map((item) => {
          const passed = state[item.id];
          return (
            <View key={item.id} style={styles.requirementTextItem}>
              {passed ? (
                <FiCheck size={12} color={Accent.base} />
              ) : (
                <View style={[styles.requirementDot, { borderColor: colors.textHint }]} />
              )}
              <ThemedText
                type="small"
                themeColor={passed ? undefined : 'textSecondary'}
                style={passed ? { color: Accent.base } : undefined}>
                {item.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
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
  passwordReveal: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
  },
  requirementsLine: { gap: Spacing.one, paddingTop: Spacing.one },
  requirementsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  requirementList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.two,
    rowGap: Spacing.one,
  },
  requirementTextItem: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  requirementDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
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
  successCard: { padding: Spacing.four, borderRadius: Radii.md, gap: Spacing.two },
  secondaryLink: { alignItems: 'center', paddingVertical: Spacing.two },
});
