import { useRouter } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiLock, FiMail } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useThemeColors } from '@/context/theme';
import { Accent, Radii, Spacing } from '@/constants/theme';

type Mode = 'magic' | 'password';
type Phase = 'idle' | 'sending' | 'sent' | 'error';

export default function LoginScreen() {
  const router = useRouter();
  const { status, signInWithMagicLink, signInWithPassword, signUpWithPassword } = useAuth();

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'signed-in') router.replace('/');
  }, [status, router]);

  function validateEmail() {
    const trimmed = email.trim();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      setErrMsg('กรุณากรอกอีเมลให้ถูกต้อง');
      setPhase('error');
      return null;
    }
    return trimmed;
  }

  async function onMagicLink() {
    const trimmed = validateEmail();
    if (!trimmed) return;
    setPhase('sending');
    setErrMsg(null);
    const { error } = await signInWithMagicLink(trimmed);
    if (error) {
      setErrMsg(error);
      setPhase('error');
      return;
    }
    setPhase('sent');
  }

  async function onPasswordSignIn() {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (password.length < 6) {
      setErrMsg('รหัสผ่านต้อง 6 ตัวอักษรขึ้นไป');
      setPhase('error');
      return;
    }
    setPhase('sending');
    setErrMsg(null);
    const { error } = await signInWithPassword(trimmed, password);
    if (error) {
      setErrMsg(error);
      setPhase('error');
    }
  }

  async function onPasswordSignUp() {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (password.length < 6) {
      setErrMsg('รหัสผ่านต้อง 6 ตัวอักษรขึ้นไป');
      setPhase('error');
      return;
    }
    setPhase('sending');
    setErrMsg(null);
    const { error, needsEmailConfirm } = await signUpWithPassword(trimmed, password);
    if (error) {
      setErrMsg(error);
      setPhase('error');
      return;
    }
    if (needsEmailConfirm) {
      setErrMsg('สมัครแล้ว · เช็คอีเมลเพื่อยืนยันก่อนเข้าสู่ระบบ');
      setPhase('sent');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.hero}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              SIGN IN · 日本分解
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              เข้าสู่ระบบ
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              เลือกแบบเข้าระบบที่สะดวก — ทั้งสองแบบใช้บัญชีเดียวกัน
            </ThemedText>
          </View>

          <ModeTabs mode={mode} onChange={(m) => { setMode(m); setPhase('idle'); setErrMsg(null); }} />

          {phase === 'sent' ? (
            <SuccessCard message={errMsg ?? `ส่งลิ้งค์ไปที่ ${email.trim()} แล้ว ✓`} onBack={() => router.replace('/')} />
          ) : (
            <WebForm onSubmit={mode === 'magic' ? onMagicLink : onPasswordSignIn}>
              <View style={styles.form}>
                <EmailField value={email} onChange={(t) => { setEmail(t); if (phase === 'error') setPhase('idle'); }} disabled={phase === 'sending'} />
                {mode === 'password' && (
                  <PasswordField value={password} onChange={(t) => { setPassword(t); if (phase === 'error') setPhase('idle'); }} disabled={phase === 'sending'} />
                )}

                {errMsg && (
                  <ThemedText type="small" style={{ color: Accent.base }}>
                    {errMsg}
                  </ThemedText>
                )}

                {mode === 'magic' ? (
                  <PrimaryButton onPress={onMagicLink} disabled={phase === 'sending'} label={phase === 'sending' ? 'กำลังส่ง…' : 'ส่งลิ้งค์'} />
                ) : (
                  <View style={styles.passwordActions}>
                    <PrimaryButton onPress={onPasswordSignIn} disabled={phase === 'sending'} label="เข้าสู่ระบบ" />
                    <SecondaryButton onPress={onPasswordSignUp} disabled={phase === 'sending'} label="สมัครใหม่" />
                  </View>
                )}

                <ThemedText type="small" themeColor="textHint" style={styles.fineprint}>
                  {mode === 'magic'
                    ? 'การกดส่งลิ้งค์ = ยอมรับเงื่อนไขใน landing page'
                    : 'การสมัคร = ยอมรับเงื่อนไขใน landing page'}
                </ThemedText>
              </View>
            </WebForm>
          )}

          <Pressable onPress={() => router.replace('/')} style={styles.cancel}>
            <ThemedText type="small" themeColor="textSecondary">
              ← กลับ Browse
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/* Web-only <form> wrapper — enables browser password manager + autofill +
   Enter-to-submit. On native, transparent passthrough.
   `display: contents` keeps RN's flex layout intact while still making the
   TextInput <input> elements DOM children of <form>. Hidden submit button
   guarantees implicit Enter submission with multiple text inputs. */
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

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { scheme, colors } = useThemeColors();
  return (
    <View style={[styles.modeTabs, { borderColor: colors.border }]}>
      <ModeTab active={mode === 'password'} onPress={() => onChange('password')} label="รหัสผ่าน" />
      <ModeTab active={mode === 'magic'} onPress={() => onChange('magic')} label="ลิ้งค์อีเมล" />
    </View>
  );
}

function ModeTab({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeTab, active && { backgroundColor: Accent.base }]}>
      <ThemedText type="small" style={{ color: active ? '#fff' : undefined }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function EmailField({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  const { scheme, colors } = useThemeColors();
  return (
    <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <FiMail size={16} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="you@example.com"
        placeholderTextColor={colors.textHint}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!disabled}
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

function PasswordField({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  const { scheme, colors } = useThemeColors();
  return (
    <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <FiLock size={16} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="รหัสผ่าน (6+ ตัวอักษร)"
        placeholderTextColor={colors.textHint}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        editable={!disabled}
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

function SuccessCard({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <ThemedView type="backgroundElement" style={styles.successCard}>
      <ThemedText type="defaultSemiBold">{message}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        เปิดอีเมลจาก Supabase Auth แล้วคลิกลิ้งค์เพื่อยืนยัน
      </ThemedText>
      <Pressable onPress={onBack} style={styles.successBack}>
        <ThemedText type="small" style={{ color: Accent.base }}>
          กลับ Browse
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function PrimaryButton({ onPress, disabled, label }: { onPress: () => void; disabled?: boolean; label: string }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { scale.value = withTiming(0.96, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }); }}
        style={({ pressed }) => [styles.primaryBtn, { backgroundColor: Accent.base, opacity: disabled ? 0.6 : pressed ? 0.88 : 1 }]}>
        <ThemedText type="defaultSemiBold" style={styles.primaryBtnLabel}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

function SecondaryButton({ onPress, disabled, label }: { onPress: () => void; disabled?: boolean; label: string }) {
  const { scheme, colors } = useThemeColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { scale.value = withTiming(0.96, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }); }}
        style={({ pressed }) => [styles.secondaryBtn, { borderColor: colors.border, opacity: disabled ? 0.6 : pressed ? 0.88 : 1 }]}>
        <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>{label}</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: 440 },
  content: { flex: 1, padding: Spacing.four, paddingTop: Spacing.six + Spacing.four, gap: Spacing.five, justifyContent: 'center' },
  hero: { gap: Spacing.two },
  eyebrow: { letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 32 },
  modeTabs: { flexDirection: 'row', borderWidth: 1, borderRadius: Radii.sm, padding: 2, gap: 2 },
  modeTab: { flex: 1, paddingVertical: Spacing.two, alignItems: 'center', borderRadius: 2 },
  form: { gap: Spacing.three },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radii.sm, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  input: { flex: 1, fontSize: 16, outlineStyle: 'none' as any },
  passwordActions: { flexDirection: 'row', gap: Spacing.two },
  primaryBtn: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Radii.sm, alignItems: 'center' },
  primaryBtnLabel: { color: '#fff' },
  secondaryBtn: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Radii.sm, alignItems: 'center', borderWidth: 1, backgroundColor: 'transparent' },
  fineprint: { textAlign: 'center' },
  successCard: { padding: Spacing.four, borderRadius: Radii.md, gap: Spacing.two },
  successBack: { marginTop: Spacing.two },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three },
});
