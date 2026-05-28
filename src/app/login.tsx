import { useRouter } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiLock, FiMail } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useThemePalette } from '@/context/theme';
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
                {/* Email field stays stable across mode swaps so focus + value
                    survive the swipe. Only the mode-specific block (password
                    row, action cluster, fineprint) swipes horizontally. */}
                <EmailField value={email} onChange={(t) => { setEmail(t); if (phase === 'error') setPhase('idle'); }} disabled={phase === 'sending'} />

                {/* Carousel container — both panels render absolute-positioned
                    inside; each lives at its tab-side "home" position when
                    inactive. Switching tabs slides the previous panel back to
                    its home (off to the side, opacity 0) while the next slides
                    in from its own home toward centre. Reads as the next panel
                    being revealed beneath. */}
                <View style={styles.modePanelContainer}>
                  <ModePanel active={mode === 'password'} side="left">
                    <PasswordField value={password} onChange={(t) => { setPassword(t); if (phase === 'error') setPhase('idle'); }} disabled={phase === 'sending'} />
                    {errMsg && (
                      <ThemedText type="small" style={{ color: Accent.base }}>
                        {errMsg}
                      </ThemedText>
                    )}
                    <View style={styles.passwordActions}>
                      <PrimaryButton onPress={onPasswordSignIn} disabled={phase === 'sending'} label="เข้าสู่ระบบ" />
                      <SecondaryButton onPress={onPasswordSignUp} disabled={phase === 'sending'} label="สมัครใหม่" />
                    </View>
                    <ThemedText type="small" themeColor="textHint" style={styles.fineprint}>
                      การสมัคร = ยอมรับเงื่อนไขใน landing page
                    </ThemedText>
                  </ModePanel>
                  <ModePanel active={mode === 'magic'} side="right">
                    {errMsg && (
                      <ThemedText type="small" style={{ color: Accent.base }}>
                        {errMsg}
                      </ThemedText>
                    )}
                    <PrimaryButton onPress={onMagicLink} disabled={phase === 'sending'} label={phase === 'sending' ? 'กำลังส่ง…' : 'ส่งลิ้งค์'} />
                    <ThemedText type="small" themeColor="textHint" style={styles.fineprint}>
                      การกดส่งลิ้งค์ = ยอมรับเงื่อนไขใน landing page
                    </ThemedText>
                  </ModePanel>
                </View>
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

/* Carousel panel — password lives left, magic lives right. Active panel
   sits at centre (translateX 0 + opacity 1); inactive panel parks at its
   home (translateX ±32 + opacity 0). Switching tabs animates both panels
   simultaneously so the user feels the next one revealed beneath. Subtle
   32px translate keeps the motion editorial-restrained, not carousel-y.
   Both panels render absolute-positioned inside a min-height container
   sized for the taller (password) mode so the back-to-Browse link below
   doesn't jump on mode swap. */
function ModePanel({ active, side, children }: { active: boolean; side: 'left' | 'right'; children: React.ReactNode }) {
  const home = side === 'left' ? -32 : 32;
  const tx = useSharedValue(active ? 0 : home);
  const opacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    tx.value = withTiming(active ? 0 : home, { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) });
    opacity.value = withTiming(active ? 1 : 0, { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [active, home, tx, opacity]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.modePanel, aStyle, { pointerEvents: active ? 'auto' : 'none' }]}>
      {children}
    </Animated.View>
  );
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <View style={styles.modeTabs}>
      <ModeTab active={mode === 'password'} onPress={() => onChange('password')} label="รหัสผ่าน" />
      <ModeTab active={mode === 'magic'} onPress={() => onChange('magic')} label="ลิ้งค์อีเมล" />
    </View>
  );
}

function ModeTab({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeTab,
        {
          borderBottomColor: active ? Accent.base : colors.border,
          borderBottomWidth: active ? 2 : 1,
        },
      ]}>
      <ThemedText
        type="small"
        style={{ color: active ? Accent.base : colors.textMuted, fontWeight: active ? '600' : '400' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function EmailField({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  const colors = useThemePalette();
  return (
    <View style={[styles.inputWrap, { borderBottomColor: colors.border }]}>
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
  const colors = useThemePalette();
  return (
    <View style={[styles.inputWrap, { borderBottomColor: colors.border }]}>
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
  const colors = useThemePalette();
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
  content: { flex: 1, padding: Spacing.four, gap: Spacing.four, justifyContent: 'center' },
  hero: { gap: Spacing.two },
  eyebrow: { letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 32 },
  modeTabs: { flexDirection: 'row', gap: Spacing.three },
  modeTab: { flex: 1, paddingVertical: Spacing.three, alignItems: 'center' },
  form: { gap: Spacing.four },
  /* minHeight reserves space for the taller (password) panel so the
     back-to-Browse link beneath doesn't jump when swapping to magic
     mode. 156 = PasswordField(~52) + gap(16) + buttons(~52) + gap(16)
     + fineprint(~20). errMsg pushes content down briefly but is
     transient. */
  modePanelContainer: { position: 'relative', minHeight: 156 },
  modePanel: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.four },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: 1, paddingHorizontal: 0, paddingVertical: Spacing.three },
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
