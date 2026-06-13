import { useRouter } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FiAlertCircle, FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';
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
import { parseAuthEmailLinkIssue, type AuthEmailLinkIssue } from '@/lib/auth-email-confirmation';
import { normalizeLoginEmail } from '@/lib/login-validation';
import { Accent, Radii, Spacing } from '@/constants/theme';

type Phase = 'idle' | 'sending' | 'sent' | 'error';
type PendingAction = 'signin' | 'resend-confirmation' | null;

export default function LoginScreen() {
  const router = useRouter();
  const { status, signInWithPassword, resendSignUpConfirmation } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [emailLinkIssue, setEmailLinkIssue] = useState<AuthEmailLinkIssue | null>(null);
  const screenEntry = useSharedValue(0);
  const passwordSubmit = emailLinkIssue ? onResendConfirmation : onPasswordSignIn;
  const passwordPrimaryLabel = emailLinkIssue
    ? pendingAction === 'resend-confirmation'
      ? 'กำลังส่งลิงก์ยืนยัน…'
      : 'ส่งลิงก์ยืนยันใหม่'
    : pendingAction === 'signin'
      ? 'กำลังเข้าสู่ระบบ…'
      : 'เข้าสู่ระบบ';

  useEffect(() => {
    screenEntry.value = withTiming(1, { duration: 210, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [screenEntry]);

  const screenEntryStyle = useAnimatedStyle(() => ({
    opacity: screenEntry.value,
    transform: [{ translateX: (1 - screenEntry.value) * -14 }],
  }));

  useEffect(() => {
    if (status === 'signed-in') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    setEmailLinkIssue(parseAuthEmailLinkIssue(window.location.href));
  }, []);

  function validateEmail() {
    const result = normalizeLoginEmail(email);
    if (!result.ok) {
      setErrMsg(result.message);
      setPhase('error');
      return null;
    }
    return result.value;
  }

  async function onPasswordSignIn() {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (!password.trim()) {
      setErrMsg('กรุณากรอกรหัสผ่าน');
      setPhase('error');
      return;
    }
    setPhase('sending');
    setPendingAction('signin');
    setErrMsg(null);
    const { error } = await signInWithPassword(trimmed, password);
    if (error) {
      setErrMsg(error);
      setPhase('error');
      setUnconfirmedEmail(error.includes('ยังไม่ได้ยืนยัน') ? trimmed : null);
    } else {
      setUnconfirmedEmail(null);
      setEmailLinkIssue(null);
    }
    setPendingAction(null);
  }

  async function onResendConfirmation() {
    const targetEmail = unconfirmedEmail ?? validateEmail();
    if (!targetEmail) return;
    setPendingAction('resend-confirmation');
    setErrMsg(null);
    const { error } = await resendSignUpConfirmation(targetEmail);
    if (error) {
      setErrMsg(error);
      setPhase('error');
      setPendingAction(null);
      return;
    }
    setUnconfirmedEmail(targetEmail);
    setEmailLinkIssue(null);
    setErrMsg(`ส่งอีเมลยืนยันไปที่ ${targetEmail} อีกครั้งแล้ว`);
    setPhase('idle');
    setPendingAction(null);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, screenEntryStyle]}>
          <View style={styles.hero}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              SIGN IN · 日本分解
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              เข้าสู่ระบบ
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ใช้อีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ Companion App
            </ThemedText>
          </View>

          {emailLinkIssue ? <EmailLinkIssueCard issue={emailLinkIssue} /> : null}

          {phase === 'sent' ? (
            <SuccessCard
              message={errMsg ?? `ส่งลิงก์ไปที่ ${email.trim()} แล้ว ✓`}
              onBack={() => router.replace('/')}
            />
          ) : (
            <WebForm onSubmit={passwordSubmit}>
              <View style={styles.form}>
                <EmailField value={email} onChange={(t) => { setEmail(t); if (phase === 'error') setPhase('idle'); }} disabled={phase === 'sending'} invalid={phase === 'error' && !!errMsg && errMsg.includes('อีเมล')} />

                {!emailLinkIssue ? (
                  <PasswordField
                    value={password}
                    onChange={(t) => { setPassword(t); if (phase === 'error') setPhase('idle'); }}
                    disabled={phase === 'sending'}
                    invalid={phase === 'error' && !!errMsg && errMsg.includes('รหัสผ่าน')}
                    visible={passwordVisible}
                    onToggleVisible={() => setPasswordVisible((v) => !v)}
                  />
                ) : null}
                {errMsg ? <StatusMessage tone={phase === 'error' ? 'error' : 'info'} message={errMsg} /> : null}
                {unconfirmedEmail && !emailLinkIssue ? (
                  <Pressable
                    onPress={onResendConfirmation}
                    disabled={pendingAction === 'resend-confirmation'}
                    accessibilityRole="button"
                    accessibilityLabel="ส่งอีเมลยืนยันอีกครั้ง"
                    style={({ pressed }) => [
                      styles.inlineRecovery,
                      pressed && pendingAction !== 'resend-confirmation' && { opacity: 0.72 },
                      pendingAction === 'resend-confirmation' && { opacity: 0.58 },
                    ]}>
                    <ThemedText type="small" style={{ color: Accent.base }}>
                      {pendingAction === 'resend-confirmation' ? 'กำลังส่งอีเมลยืนยัน…' : 'ส่งอีเมลยืนยันอีกครั้ง'}
                    </ThemedText>
                  </Pressable>
                ) : null}
                <View style={styles.passwordActions}>
                  <PrimaryButton
                    onPress={passwordSubmit}
                    disabled={phase === 'sending' || pendingAction === 'resend-confirmation'}
                    label={passwordPrimaryLabel}
                  />
                </View>
                {!emailLinkIssue ? (
                  <Pressable onPress={() => router.push('/forgot-password')} style={styles.recoveryLink}>
                    <ThemedText type="small" themeColor="textSecondary">
                      ลืมรหัสผ่าน?
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => router.push('/signup')} style={styles.signupLink}>
                  <ThemedText type="small" style={{ color: Accent.base }}>
                    สมัครบัญชีใหม่
                  </ThemedText>
                </Pressable>
              </View>
            </WebForm>
          )}

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

function EmailLinkIssueCard({ issue }: { issue: AuthEmailLinkIssue }) {
  return (
    <View style={styles.emailLinkIssueCard}>
      <View style={styles.emailLinkIssueHeader}>
        <FiAlertCircle size={15} color={Accent.base} />
        <ThemedText type="small" style={{ color: Accent.base, fontWeight: '700' }}>
          {issue.title}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.emailLinkIssueBody}>
        {issue.message}
      </ThemedText>
    </View>
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
        placeholder="รหัสผ่าน"
        placeholderTextColor={colors.textHint}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="รหัสผ่าน"
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

function SuccessCard({
  message,
  onBack,
  onResend,
  resendBusy = false,
}: {
  message: string;
  onBack: () => void;
  onResend?: () => void;
  resendBusy?: boolean;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.successCard}>
      <ThemedText type="defaultSemiBold">{message}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        เปิดอีเมลจาก Nihon Bunkai แล้วกดลิงก์ยืนยัน จากนั้นกลับมาเข้าสู่ระบบอีกครั้ง
      </ThemedText>
      {onResend ? (
        <Pressable
          onPress={onResend}
          disabled={resendBusy}
          accessibilityRole="button"
          accessibilityLabel="ส่งอีเมลยืนยันอีกครั้ง"
          style={({ pressed }) => [
            styles.successResend,
            pressed && !resendBusy && { opacity: 0.72 },
            resendBusy && { opacity: 0.58 },
          ]}>
          <ThemedText type="small" style={{ color: Accent.base }}>
            {resendBusy ? 'กำลังส่งอีกครั้ง…' : 'ส่งอีเมลยืนยันอีกครั้ง'}
          </ThemedText>
        </Pressable>
      ) : null}
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
  emailLinkIssueCard: {
    borderWidth: 1,
    borderColor: Accent.soft,
    backgroundColor: Accent.bg,
    borderRadius: Radii.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
  emailLinkIssueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  emailLinkIssueBody: {
    lineHeight: 20,
  },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: 1, paddingHorizontal: 0, paddingVertical: Spacing.three },
  input: { flex: 1, fontSize: 16, outlineStyle: 'none' as any },
  passwordReveal: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
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
  passwordActions: { flexDirection: 'row', gap: Spacing.two },
  inlineRecovery: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  recoveryLink: { alignItems: 'center', paddingVertical: Spacing.one },
  signupLink: { alignItems: 'center', paddingVertical: Spacing.two },
  primaryBtn: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Radii.sm, alignItems: 'center' },
  primaryBtnLabel: { color: '#fff' },
  successCard: { padding: Spacing.four, borderRadius: Radii.md, gap: Spacing.two },
  successResend: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  successBack: { marginTop: Spacing.two },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three },
});
