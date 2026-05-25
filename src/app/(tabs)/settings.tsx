import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiCheck, FiCheckSquare, FiChevronRight, FiLogIn, FiLogOut, FiRefreshCw, FiSquare, FiUser } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ColumnVisibility } from '@/components/flashcard';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  const { status, user, entitledPacks, entitledSkus, signOut, refreshEntitlements } = useAuth();
  const entitlementCount = entitledPacks.size + entitledSkus.size;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator>
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
              การ์ด
            </ThemedText>
            <CardMetaToggle />
            <CardColumnsRow />
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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function CardMetaToggle() {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const [showMeta, setShowMeta] = usePersistedState<boolean>('show-card-meta', true);
  const Icon = showMeta ? FiCheckSquare : FiSquare;
  const iconColor = showMeta ? Accent.base : colors.text;
  return (
    <Pressable
      onPress={() => setShowMeta(!showMeta)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: showMeta }}
      accessibilityLabel="แสดง Badge ที่มุมบนซ้ายของการ์ด"
      style={({ pressed }) => [
        styles.cardMetaRow,
        { borderColor: colors.border, backgroundColor: showMeta ? Accent.bg : 'transparent' },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">Badge บนการ์ด</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ป้ายมุมบนซ้าย แสดงลำดับการ์ดและชื่อ deck
        </ThemedText>
        <ThemedText type="small" themeColor="textHint" style={{ marginTop: 2 }}>
          {showMeta ? 'กำลังแสดงอยู่ · แตะเพื่อซ่อน' : 'กำลังซ่อนอยู่ · แตะเพื่อแสดง'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Compact summary row in Settings with inline accordion — tap to expand
 *  the full ColumnsConfig below the row. Reuses persisted visibility so
 *  Settings ↔ per-card popup stay in sync. */
function CardColumnsRow() {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const [vis] = usePersistedState<ColumnVisibility>(
    'visibility',
    { t: true, pf: true, pb: true, d: true, e: true },
  );
  const [expanded, setExpanded] = useState(false);

  const frontTokens = [vis.t && 'T', vis.pf && 'Pf'].filter(Boolean) as string[];
  const backTokens  = [vis.d && 'D', vis.pb && 'Pb', vis.e && 'E'].filter(Boolean) as string[];
  const summary = `${frontTokens.join(' · ') || '—'}  /  ${backTokens.join(' · ') || '—'}`;

  /* Chevron rotates 90° as the accordion expands — smooth deliberate motion
     that mirrors the panel reveal below. */
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withTiming(expanded ? 90 : 0, { duration: 220, easing: Easing.bezier(0.455, 0.03, 0.515, 0.955) });
  }, [expanded, rot]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="ตั้งค่าคอลัมน์ที่แสดงบนการ์ด"
        style={({ pressed }) => [
          styles.cardMetaRow,
          { borderColor: colors.border },
          pressed && { opacity: 0.85 },
        ]}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold">คอลัมน์ที่แสดง</ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{
              fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
              letterSpacing: 0.6,
            } as any}>
            {summary}
          </ThemedText>
        </View>
        <Animated.View style={chevronStyle}>
          <FiChevronRight size={18} color={colors.textHint} />
        </Animated.View>
      </Pressable>
      {expanded && (
        <Animated.View
          style={{ paddingLeft: Spacing.two }}
          entering={FadeIn.duration(180).easing(Easing.bezier(0.25, 0.46, 0.45, 0.94))}
          exiting={FadeOut.duration(130)}>
          <ColumnsConfig />
        </Animated.View>
      )}
    </View>
  );
}

/** Persisted column visibility config — same storage key as Study screen so
 *  Settings ↔ per-card popup stay in sync. Each face must keep ≥ 1 column. */
function ColumnsConfig() {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const [vis, setVis] = usePersistedState<ColumnVisibility>(
    'visibility',
    { t: true, pf: true, pb: true, d: true, e: true },
  );

  const frontCount = (vis.t ? 1 : 0) + (vis.pf ? 1 : 0);
  const backCount  = (vis.d ? 1 : 0) + (vis.pb ? 1 : 0) + (vis.e ? 1 : 0);

  function toggle(key: keyof ColumnVisibility) {
    const next = { ...vis, [key]: !vis[key] };
    if (!next.t && !next.pf) return;                       // front must keep ≥ 1
    if (!next.d && !next.pb && !next.e) return;            // back must keep ≥ 1
    setVis(next);
  }

  return (
    <View style={{ gap: Spacing.two }}>
      {/* ─── ด้านหน้า ─── */}
      <View style={{ gap: Spacing.one }}>
        <ThemedText style={[columnsStyles.subhead, { color: colors.textHint }]}>
          // FRONT · ด้านหน้า
        </ThemedText>
        <ColumnRow
          checked={vis.t}
          locked={vis.t && frontCount === 1}
          colors={colors}
          onPress={() => toggle('t')}
          label="คำศัพท์ (T)"
          hint="คันจิ / คะนะ ด้านหน้า"
        />
        <ColumnRow
          checked={vis.pf}
          locked={vis.pf && frontCount === 1}
          colors={colors}
          onPress={() => toggle('pf')}
          label="คำอ่าน ด้านหน้า (Pf)"
          hint="ปิดถ้าอยากบังคับให้นึก"
        />
      </View>

      {/* ─── ด้านหลัง ─── */}
      <View style={{ gap: Spacing.one }}>
        <ThemedText style={[columnsStyles.subhead, { color: colors.textHint }]}>
          // BACK · ด้านหลัง
        </ThemedText>
        <ColumnRow
          checked={vis.d}
          locked={vis.d && backCount === 1}
          colors={colors}
          onPress={() => toggle('d')}
          label="ความหมาย (D)"
          hint="คำแปลไทยขนาด title"
        />
        <ColumnRow
          checked={vis.pb}
          locked={vis.pb && backCount === 1}
          colors={colors}
          onPress={() => toggle('pb')}
          label="คำอ่าน ด้านหลัง (Pb)"
          hint="ตั้งแยกจากด้านหน้า"
        />
        <ColumnRow
          checked={vis.e}
          locked={vis.e && backCount === 1}
          colors={colors}
          onPress={() => toggle('e')}
          label="คำอธิบาย (E)"
          hint="Breakdown / Examples ของแต่ละข้อ"
        />
      </View>
    </View>
  );
}

function ColumnRow({
  checked,
  locked,
  colors,
  onPress,
  label,
  hint,
}: {
  checked: boolean;
  locked: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
  label: string;
  hint: string;
}) {
  const Icon = checked ? FiCheckSquare : FiSquare;
  const iconColor = locked ? colors.textHint : checked ? Accent.base : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: locked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        columnsStyles.row,
        {
          borderColor: colors.border,
          backgroundColor: locked
            ? colors.backgroundSelected
            : checked
              ? Accent.bg
              : 'transparent',
        },
        pressed && !locked && { opacity: 0.85 },
        locked && { opacity: 0.85 },
      ]}>
      <Icon size={16} color={iconColor} strokeWidth={2} />
      <ThemedText type="defaultSemiBold" style={{ marginRight: 4 }}>{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
        · {locked ? 'ล็อก — ต้องมี ≥ 1 คอลัมน์' : hint}
      </ThemedText>
    </Pressable>
  );
}

const columnsStyles = StyleSheet.create({
  subhead: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
});

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
  /* Container + safeArea fill the viewport (no maxWidth) so the ScrollView
     scrollbar sits flush against the right edge of the viewport. The
     centered max-width clamp lives on `content` instead. */
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
    /* Reserve space for the scrollbar so toggling the accordion doesn't
       shift the layout sideways when the scrollbar appears/disappears. */
    ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as object) : null),
  } as any,
  /* contentContainer wraps everything inside the scroll — centers it. */
  contentContainer: { alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  section: { gap: Spacing.two },
  sectionLabel: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  accountCard: {
    padding: Spacing.two,
    borderRadius: Radii.sm,
    gap: Spacing.two,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
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
    padding: Spacing.two,
    borderRadius: 4,
    gap: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
});
