import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FiCheck, FiLogIn, FiLogOut, FiRefreshCw, FiUser } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemeToggle } from '@/components/theme-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  const { status, user, entitledPacks, entitledSkus, signOut, refreshEntitlements } = useAuth();
  const entitlementCount = entitledPacks.size + entitledSkus.size;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">Settings</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Account · Theme · About
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              บัญชี
            </ThemedText>
            <AccountCard
              status={status}
              email={user?.email}
              entitlementCount={entitlementCount}
              onSignOut={signOut}
              onRefresh={refreshEntitlements}
            />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ธีม
            </ThemedText>
            <ThemeToggle />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ABOUT
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.aboutCard}>
              <ThemedText type="defaultSemiBold">Nihon Bunkai · Companion App</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                v0.1.0 · Phase 1.2 build · web preview
              </ThemedText>
            </ThemedView>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function AccountCard({
  status,
  email,
  entitlementCount,
  onSignOut,
  onRefresh,
}: {
  status: 'loading' | 'signed-in' | 'signed-out';
  email?: string;
  entitlementCount: number;
  onSignOut: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;

  if (status === 'loading') {
    return (
      <ThemedView type="backgroundElement" style={styles.accountCard}>
        <ThemedText type="small" themeColor="textHint">
          กำลังโหลด…
        </ThemedText>
      </ThemedView>
    );
  }

  if (status === 'signed-out') {
    return (
      <Link href="/login" asChild>
        <Pressable>
          <ThemedView type="backgroundElement" style={styles.accountCard}>
            <View style={styles.accountRow}>
              <FiLogIn size={18} color={Accent.base} />
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>
                  เข้าสู่ระบบ
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  เพื่อปลดล็อก pack ที่ซื้อแล้ว · sync ระหว่างเครื่อง
                </ThemedText>
              </View>
            </View>
          </ThemedView>
        </Pressable>
      </Link>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.accountCard}>
      <View style={styles.accountRow}>
        <View style={[styles.avatar, { backgroundColor: Accent.bg }]}>
          <FiUser size={16} color={Accent.base} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold">{email}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {entitlementCount} pack ปลดล็อก
          </ThemedText>
        </View>
      </View>
      <View style={styles.accountActionsRow}>
        <RestoreBtn onRefresh={onRefresh} borderColor={colors.border} textColor={colors.text} />
        <SignOutBtn
          onPress={async () => {
            await onSignOut();
          }}
          borderColor={colors.border}
          textColor={colors.text}
        />
      </View>
    </ThemedView>
  );
}

function RestoreBtn({
  onRefresh,
  borderColor,
  textColor,
}: {
  onRefresh: () => Promise<void>;
  borderColor: string;
  textColor: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  async function handlePress() {
    if (state === 'loading') return;
    setState('loading');
    await onRefresh();
    setState('done');
    setTimeout(() => setState('idle'), 1800);
  }

  const label =
    state === 'loading' ? 'กำลังตรวจสอบ…' :
    state === 'done'    ? 'อัพเดทแล้ว' :
                          'อัพเดทการซื้อ';

  const IconCmp = state === 'done' ? FiCheck : FiRefreshCw;
  const color = state === 'done' ? Accent.base : textColor;

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) });
        }}
        style={({ pressed }) => [
          styles.signOutBtn,
          { borderColor, opacity: pressed ? 0.7 : 1 },
        ]}>
        <IconCmp size={14} color={color} />
        <ThemedText type="small" style={{ color }}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

function SignOutBtn({
  onPress,
  borderColor,
  textColor,
}: {
  onPress: () => Promise<void>;
  borderColor: string;
  textColor: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) });
        }}
        style={({ pressed }) => [
          styles.signOutBtn,
          { borderColor, opacity: pressed ? 0.7 : 1 },
        ]}>
        <FiLogOut size={14} color={textColor} />
        <ThemedText type="small" style={{ color: textColor }}>
          ออกจากระบบ
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    flex: 1,
    padding: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.six,
  },
  header: { gap: Spacing.one },
  section: { gap: Spacing.two },
  sectionLabel: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  accountCard: {
    padding: Spacing.three,
    borderRadius: Radii.md,
    gap: Spacing.three,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  accountActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  aboutCard: {
    padding: Spacing.three,
    borderRadius: 4,
    gap: Spacing.one,
  },
});
