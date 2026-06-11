import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiAlertTriangle, FiCheck, FiCheckSquare, FiChevronRight, FiDownload, FiExternalLink, FiHelpCircle, FiLogIn, FiLogOut, FiMail, FiPackage, FiRefreshCw, FiShield, FiSquare, FiUpload, FiUser, FiX } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ColumnVisibility } from '@/components/flashcard';
import { ImportHowToContent } from '@/components/import-how-to-content';
import { PwaShortcutNudge } from '@/components/pwa-shortcut-nudge';
import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth';
import { useThemePalette } from '@/context/theme';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { DECKS_IMPORTED_EVENT } from '@/lib/deck-import';
import {
  downloadLocalDataBackup,
  readLocalDataBackupFile,
  restoreLocalDataBackupToStorage,
} from '@/lib/local-data-backup-store';
import { summarizeLocalDataBackup, type LocalDataBackupDocument, type LocalDataBackupSummary } from '@/lib/local-data-backup';
import { supabase } from '@/lib/supabase';
import { SUPPORT_EMAIL, buildSupportMailto, type SupportIssue } from '@/lib/support-safety';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

const SCROLL_TOP_THRESHOLD = 400;
const SETTINGS_ACTION_SURFACE = Platform.select({
  web: 'var(--settings-action-surface)',
  default: undefined,
});

function getSettingsActionSurface(colors: typeof Colors.light) {
  return SETTINGS_ACTION_SURFACE ?? colors.surface3;
}

export default function SettingsScreen() {
  const params = useLocalSearchParams<{ scrollTop?: string }>();
  const { status, user, entitledPacks, entitledSkus, signOut, refreshEntitlements } = useAuth();
  const colors = useThemePalette();
  const entitlementCount = entitledPacks.size + entitledSkus.size;
  const scrollRef = useRef<ScrollView>(null);
  const scrollTopParam = Array.isArray(params.scrollTop) ? params.scrollTop[0] : params.scrollTop;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [importHowToVisible, setImportHowToVisible] = useState(false);

  useEffect(() => {
    if (!scrollTopParam) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setShowScrollTop(false);
    }, 0);
    return () => clearTimeout(id);
  }, [scrollTopParam]);

  return (
    <ThemedView style={styles.container}>
      {/* Ghost kanji 設 (set/establish, as in 設定) — sticky background
          decoration. Mirrors Shop's muted scale; lives at ThemedView root
          so it stays fixed while the settings list scrolls. */}
      <ThemedText style={[styles.ghostKanji, { color: colors.textHint }]}>
        設
      </ThemedText>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            setShowScrollTop((prev) => {
              const next = y > SCROLL_TOP_THRESHOLD;
              return prev === next ? prev : next;
            });
          }}
          scrollEventThrottle={100}>
          <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">Settings</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              บัญชี · ธีม · การ์ด · ความปลอดภัย
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

          <PwaShortcutNudge placement="settings" />

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              การ์ด
            </ThemedText>

            {/* Quiz card group — flip mode (active recall + FSRS). */}
            <ThemedText style={styles.cardGroupHead}>// QUIZ CARD · ทดสอบ</ThemedText>
            <CardMetaToggle />
            <CardColumnsRow title="คอลัมน์ที่แสดง" storageKey="visibility" />

            {/* Learn card group — all-fields mode (passive review). */}
            <ThemedText style={[styles.cardGroupHead, { marginTop: Spacing.three }]}>
              // LEARN CARD · เปิดดู
            </ThemedText>
            <CardColumnsRow title="คอลัมน์ที่แสดง" storageKey="visibility-learn" />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              นำเข้า · IMPORT
            </ThemedText>
            <ImportExportHelp onOpenHowTo={() => setImportHowToVisible(true)} />
          </View>

          {/* Auto-sync toggle — only shown when signed in, since guest mode
              doesn't have a cloud destination. Auth context reads this
              key + wires startSync/stopSync accordingly. */}
          {user && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                ซิงค์ข้อมูล
              </ThemedText>
              <AutoSyncToggle />
            </View>
          )}

          {/* Restore Purchases — only useful when signed in. Covers two cases:
              (a) bought with email A, signed in with email B (manual claim)
              (b) re-signup after account delete with same email (auto-drains
              via trigger, but the form is the explicit support fallback). */}
          {user && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                กู้คืนการสั่งซื้อ
              </ThemedText>
              <RestoreSection onRestored={refreshEntitlements} />
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ความปลอดภัยของ Library
            </ThemedText>
            <LocalDataSafetyCard />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ช่วยเหลือ · SUPPORT
            </ThemedText>
            <SupportSection userEmail={user?.email} />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              ความเป็นส่วนตัว
            </ThemedText>
            <PrivacySection userEmail={user?.email} />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              เกี่ยวกับ · ABOUT
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
      <ScrollToTop
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
      <Modal
        visible={importHowToVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportHowToVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setImportHowToVisible(false)}>
          <Pressable
            style={[
              styles.modalPanel,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderTopColor: Accent.base,
              },
            ]}
            onPress={(event) => event.stopPropagation?.()}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.modalTitleRow}>
                  <View style={styles.modalTitlePip} />
                  <ThemedText type="defaultSemiBold">วิธีนำเข้า</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  เตรียมไฟล์ CSV/ZIP แล้วนำเข้า Library โดยตรง
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setImportHowToVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="ปิดวิธีเตรียม CSV"
                style={({ pressed, hovered }: any) => [
                  styles.modalCloseButton,
                  (pressed || hovered) && { backgroundColor: Accent.bg },
                  pressed && { opacity: 0.72 },
                ]}>
                {({ pressed, hovered }: any) => (
                  <FiX size={20} color={(pressed || hovered) ? Accent.base : colors.text} strokeWidth={2} />
                )}
              </Pressable>
            </View>
            <ImportHowToContent />
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function CardMetaToggle() {
  const colors = useThemePalette();
  const actionSurface = getSettingsActionSurface(colors);
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
        { borderColor: actionSurface, backgroundColor: actionSurface },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">ป้ายบนการ์ด</ThemedText>
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

/** Auto-sync (meta) toggle. ON = listeners + pull on sign-in/focus +
 *  debounced push on local writes. OFF = local-only mode (pending
 *  queue still persists, drains on next ON). Same row pattern as
 *  CardMetaToggle for visual consistency. */
function AutoSyncToggle() {
  const colors = useThemePalette();
  const actionSurface = getSettingsActionSurface(colors);
  const [enabled, setEnabled] = usePersistedState<boolean>('auto-sync', true);
  const Icon = enabled ? FiCheckSquare : FiSquare;
  const iconColor = enabled ? Accent.base : colors.text;
  return (
    <Pressable
      onPress={() => setEnabled(!enabled)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel="ซิงค์ความคืบหน้าและสถิติไปยังคลาวด์อัตโนมัติ"
      style={({ pressed }) => [
        styles.cardMetaRow,
        { borderColor: actionSurface, backgroundColor: actionSurface },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">ซิงค์อัตโนมัติ</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ความคืบหน้า FSRS · session · streak — ไม่รวม content
        </ThemedText>
        <ThemedText type="small" themeColor="textHint" style={{ marginTop: 2 }}>
          {enabled
            ? 'เปิดอยู่ · ซิงค์เมื่อเข้าสู่ระบบ + เปิดแท็บ'
            : 'ปิดอยู่ · เก็บเฉพาะในเครื่องนี้'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function ImportExportHelp({ onOpenHowTo }: { onOpenHowTo: () => void }) {
  const colors = useThemePalette();
  const actionSurface = getSettingsActionSurface(colors);
  return (
    <ThemedView type="backgroundElement" style={styles.aboutCard}>
      <Pressable
        onPress={onOpenHowTo}
        onPressIn={onOpenHowTo}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="เปิดวิธีเตรียม CSV เพื่อนำเข้า"
        style={({ pressed }) => [
          styles.howToHelpRow,
          { borderColor: colors.border, backgroundColor: actionSurface },
          pressed && { opacity: 0.82 },
        ]}>
        <FiHelpCircle size={18} color={Accent.base} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold">วิธีนำเข้า</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            เตรียม CSV/ZIP จาก Sheets หรือ Excel แล้วนำเข้า Library
          </ThemedText>
        </View>
        <FiChevronRight size={18} color={colors.textHint} />
      </Pressable>
    </ThemedView>
  );
}

/** Compact summary row in Settings with inline accordion — tap to expand
 *  the full ColumnsConfig below the row. Reuses persisted visibility so
 *  Settings ↔ per-card popup stay in sync. */
/** Accordion row for column-visibility config. Parameterized so the same
 *  pattern serves both Quiz and Learn modes — each has its own persisted
 *  visibility key. */
function CardColumnsRow({
  title,
  storageKey,
}: {
  title: string;
  storageKey: 'visibility' | 'visibility-learn';
}) {
  const colors = useThemePalette();
  const actionSurface = getSettingsActionSurface(colors);
  const [vis] = usePersistedState<ColumnVisibility>(
    storageKey,
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
        accessibilityLabel={`ตั้งค่าคอลัมน์ที่แสดงบนการ์ด · ${title}`}
        style={({ pressed }) => [
          styles.cardMetaRow,
          { borderColor: actionSurface, backgroundColor: actionSurface },
          pressed && { opacity: 0.85 },
        ]}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
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
          <ColumnsConfig storageKey={storageKey} />
        </Animated.View>
      )}
    </View>
  );
}

/** Persisted column visibility config — Quiz uses key 'visibility',
 *  Learn (Memorize) uses 'visibility-learn'. Each face must keep ≥ 1
 *  column. */
function ColumnsConfig({ storageKey }: { storageKey: 'visibility' | 'visibility-learn' }) {
  const colors = useThemePalette();
  const [vis, setVis] = usePersistedState<ColumnVisibility>(
    storageKey,
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
  const actionSurface = getSettingsActionSurface(colors);
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
          borderColor: locked ? colors.surface2 : actionSurface,
          backgroundColor: locked
            ? colors.surface2
            : actionSurface,
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

/* ─── RESTORE PURCHASES ────────────────────────────────────────────────
   Calls the `claim_purchases_by_order` RPC with (order_id, buyer_email).
   Server-side requires both to match a purchase_record with linked_user_id
   IS NULL — prevents cross-account hijacking. After success, refreshes
   entitlements so Shop's Download buttons update immediately. */

type ClaimResult = { claimed_sku: string; payhip_order_id: string };

function RestoreSection({ onRestored }: { onRestored: () => Promise<void> }) {
  const colors = useThemePalette();
  const { showToast } = useToast();
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const trimmedOrder = orderId.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedOrder || !trimmedEmail) {
      showToast('กรอก Order ID + email ที่ใช้ซื้อ', { kind: 'error' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('claim_purchases_by_order', {
      p_order_id: trimmedOrder,
      p_buyer_email: trimmedEmail,
    });
    setSubmitting(false);
    if (error) {
      console.warn('[restore] claim failed', error);
      showToast(`กู้คืนไม่สำเร็จ: ${error.message}`, { kind: 'error' });
      return;
    }
    const rows = (data as ClaimResult[] | null) ?? [];
    if (rows.length === 0) {
      showToast('ไม่พบรายการที่กู้คืนได้ — เช็ค Order ID + email อีกครั้ง', { kind: 'info' });
      return;
    }
    setOrderId('');
    setEmail('');
    await onRestored();
    showToast(`กู้คืน ${rows.length} รายการสำเร็จ`, { kind: 'success' });
  }

  return (
    <ThemedView type="backgroundElement" style={restoreStyles.card}>
      <View style={restoreStyles.headerRow}>
        <FiPackage size={18} color={Accent.base} />
        <ThemedText type="defaultSemiBold">ซื้อด้วย email อื่น?</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={restoreStyles.subtitle}>
        ใส่ Payhip Order ID + email ที่ใช้ตอนซื้อ — ระบบจะผูก SKU เข้า account นี้ให้
      </ThemedText>

      <View style={[restoreStyles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          value={orderId}
          onChangeText={setOrderId}
          placeholder="Payhip Order ID (เช่น 8B1oMwnmWZ)"
          placeholderTextColor={colors.textHint}
          editable={!submitting}
          autoCapitalize="none"
          autoCorrect={false}
          style={[restoreStyles.input, { color: colors.text }]}
        />
      </View>

      <View style={[restoreStyles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email ที่ใช้ตอนซื้อ"
          placeholderTextColor={colors.textHint}
          editable={!submitting}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={[restoreStyles.input, { color: colors.text }]}
        />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={({ pressed }) => [
          restoreStyles.submitBtn,
          { backgroundColor: Accent.base },
          (pressed || submitting) && { opacity: 0.7 },
        ]}>
        <ThemedText type="defaultSemiBold" style={restoreStyles.submitLabel}>
          {submitting ? 'กำลังกู้คืน…' : 'กู้คืนสิทธิ์'}
        </ThemedText>
      </Pressable>

      <ThemedText type="small" themeColor="textHint" style={restoreStyles.hint}>
        Order ID อยู่ใน Payhip receipt email · ถ้ายังหาไม่เจอ ติดต่อ {SUPPORT_EMAIL}
      </ThemedText>
    </ThemedView>
  );
}

const restoreStyles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Radii.md,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  subtitle: { lineHeight: 18 },
  inputWrap: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  input: {
    fontSize: 14,
    outlineStyle: 'none' as any,
  },
  submitBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.sm,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitLabel: { color: '#fff' },
  hint: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

/* ─── PRIVACY ──────────────────────────────────────────────────────── */

/** Privacy section per GPT verdict — no self-serve delete in v1, just a
 *  mailto request channel + transparent copy about what gets deleted and
 *  how purchase restoration works. Self-serve delete is P1 backlog. */
function PrivacySection({ userEmail }: { userEmail?: string }) {
  const colors = useThemePalette();
  const actionSurface = getSettingsActionSurface(colors);

  function onRequestDeletion() {
    const subject = encodeURIComponent('[Account Deletion Request]');
    const bodyLines = [
      'สวัสดีครับ/ค่ะ',
      '',
      'ขอลบบัญชีและข้อมูลส่วนตัวของฉันจากระบบ Nihon Bunkai',
      '',
      userEmail ? `Email: ${userEmail}` : 'Email (กรอกอีเมลที่ใช้สมัคร): ',
      '',
      'เหตุผล (ไม่จำเป็น): ',
      '',
      '— ส่งจาก Settings · companion app',
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      /* If mailto fails (no default mail client), at least surface the address */
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.prompt('ส่งอีเมลขอลบบัญชีไปที่:', SUPPORT_EMAIL);
      }
    });
  }

  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable
        onPress={onRequestDeletion}
        accessibilityRole="link"
        accessibilityLabel="ขอลบบัญชีและข้อมูล"
        style={({ pressed }) => [
          privacyStyles.linkRow,
          { borderColor: actionSurface, backgroundColor: actionSurface },
          pressed && { opacity: 0.85 },
        ]}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>
            ขอลบบัญชี · ข้อมูล
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ส่งคำขอผ่านอีเมล · {SUPPORT_EMAIL}
          </ThemedText>
        </View>
        <FiExternalLink size={16} color={Accent.base} strokeWidth={2} />
      </Pressable>

      <ThemedView type="backgroundElement" style={privacyStyles.disclaimer}>
        <ThemedText type="small" themeColor="textSecondary" style={privacyStyles.disclaimerLine}>
          • ลบสิทธิ์เข้าสู่ระบบ · ข้อมูลโปรไฟล์
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={privacyStyles.disclaimerLine}>
          • ลบ session ที่ sync ไว้ (ถ้ามี)
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={privacyStyles.disclaimerLine}>
          • Content ที่ซื้อแล้ว — restore ได้ภายหลังด้วย Payhip order ID เดิม
        </ThemedText>
        <ThemedText type="small" themeColor="textHint" style={{ marginTop: Spacing.one }}>
          ทีม support จะตอบกลับภายใน 1-2 วันทำการ
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const privacyStyles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  disclaimer: {
    padding: Spacing.three,
    borderRadius: Radii.sm,
    gap: 2,
  },
  disclaimerLine: {
    lineHeight: 18,
  },
});

/* ─── LOCAL DATA + SUPPORT SAFETY ───────────────────────────────────── */

function LocalDataSafetyCard() {
  const colors = useThemePalette();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    document: LocalDataBackupDocument;
    summary: LocalDataBackupSummary;
  } | null>(null);

  async function onExportBackup() {
    if (busy) return;
    setBusy('backup');
    try {
      const summary = await downloadLocalDataBackup();
      showToast(`ส่งออก backup แล้ว · ${formatBackupSummary(summary)}`, { kind: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ส่งออก backup ไม่สำเร็จ';
      showToast(message, { kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function onPickRestore() {
    if (busy) return;
    const [file] = await pickBackupFiles();
    if (!file) return;
    const parsed = await readLocalDataBackupFile(file);
    if (!parsed.ok) {
      showToast(parsed.reason, { kind: 'error' });
      return;
    }
    setPendingRestore({ document: parsed.document, summary: summarizeLocalDataBackup(parsed.document) });
  }

  async function onConfirmRestore() {
    if (!pendingRestore || busy) return;
    setBusy('restore');
    try {
      const summary = await restoreLocalDataBackupToStorage(pendingRestore.document);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DECKS_IMPORTED_EVENT, { detail: { source: 'local-backup-restore' } }));
      }
      setPendingRestore(null);
      showToast(`นำ backup กลับแล้ว · ${formatBackupSummary(summary)}`, { kind: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'นำ backup กลับไม่สำเร็จ';
      showToast(message, { kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={safetyStyles.card}>
      <View style={safetyStyles.headerRow}>
        <FiShield size={18} color={Accent.base} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold">สำรองข้อมูลในเครื่อง</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            สำหรับ custom deck · Personal Edit · progress ที่อยู่ใน browser นี้
          </ThemedText>
        </View>
      </View>
      <SafetyLine>
        Official content ที่ซื้อแล้วตรวจสิทธิ์จาก account แล้ว download/import ใหม่ได้
      </SafetyLine>
      <SafetyLine>
        PDF ใช้ Payhip receipt หรือ Payhip account เป็นทาง download หลัก
      </SafetyLine>
      <SafetyLine emphasis>
        ข้อมูลที่สร้างหรือ import เองควรส่งออก backup ก่อนล้าง browser data หรือย้ายเครื่อง
      </SafetyLine>
      <View style={safetyStyles.backupActions}>
        <SafetyActionButton
          icon="download"
          label={busy === 'backup' ? 'กำลังส่งออก…' : 'ส่งออก backup'}
          hint="บันทึก local user data เป็นไฟล์ JSON"
          borderColor={colors.border}
          disabled={!!busy}
          onPress={onExportBackup}
        />
        <SafetyActionButton
          icon="upload"
          label={busy === 'restore' ? 'กำลังนำกลับ…' : 'นำ backup กลับ'}
          hint="เลือกไฟล์ JSON แล้ว merge กลับเข้าเครื่องนี้"
          borderColor={colors.border}
          disabled={!!busy}
          onPress={onPickRestore}
        />
      </View>
      {pendingRestore ? (
        <View style={[safetyStyles.restorePreview, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <View style={safetyStyles.restorePreviewHeader}>
            <FiUpload size={15} color={Accent.base} />
            <ThemedText type="defaultSemiBold">ตรวจพบไฟล์ backup</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={safetyStyles.subtitle}>
            {formatBackupSummary(pendingRestore.summary)}
          </ThemedText>
          <ThemedText type="small" themeColor="textHint" style={safetyStyles.subtitle}>
            ระบบจะ merge/update ข้อมูลเดิม ไม่ล้าง Library ทั้งหมด
          </ThemedText>
          <View style={safetyStyles.restoreActions}>
            <Pressable
              onPress={() => setPendingRestore(null)}
              disabled={!!busy}
              style={({ pressed }) => [
                safetyStyles.restoreButton,
                { borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" themeColor="textSecondary">ยกเลิก</ThemedText>
            </Pressable>
            <Pressable
              onPress={onConfirmRestore}
              disabled={!!busy}
              style={({ pressed }) => [
                safetyStyles.restoreButton,
                { borderColor: Accent.base, backgroundColor: Accent.bg },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText type="small" style={{ color: Accent.base }}>
                {busy === 'restore' ? 'กำลังนำกลับ…' : 'นำกลับเข้าเครื่องนี้'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

function SafetyActionButton({
  icon,
  label,
  hint,
  borderColor,
  disabled,
  onPress,
}: {
  icon: 'download' | 'upload';
  label: string;
  hint: string;
  borderColor: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const Icon = icon === 'download' ? FiDownload : FiUpload;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        safetyStyles.backupButton,
        { borderColor },
        pressed && !disabled && { opacity: 0.76 },
        disabled && { opacity: 0.58 },
      ]}>
      <Icon size={15} color={Accent.base} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="defaultSemiBold" style={{ color: Accent.base }}>
          {label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function formatBackupSummary(summary: LocalDataBackupSummary): string {
  return [
    `${summary.decks} deck`,
    `${summary.entries} term`,
    `${summary.personalEdits} personal edit`,
    `${summary.cardStates} progress`,
    `${summary.sessions} session`,
    summary.hasStreak ? 'streak meta' : null,
  ].filter(Boolean).join(' · ');
}

async function pickBackupFiles(): Promise<File[]> {
  if (typeof document === 'undefined') return [];
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.multiple = false;
    input.style.display = 'none';
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      resolve(files);
    };
    document.body.appendChild(input);
    input.click();
  });
}

function SafetyLine({ children, emphasis = false }: { children: string; emphasis?: boolean }) {
  return (
    <View style={safetyStyles.lineRow}>
      <FiAlertTriangle size={14} color={emphasis ? Accent.base : '#9a8f83'} />
      <ThemedText
        type="small"
        themeColor={emphasis ? undefined : 'textSecondary'}
        style={[safetyStyles.lineText, emphasis && { color: Accent.base }]}>
        {children}
      </ThemedText>
    </View>
  );
}

function SupportSection({ userEmail }: { userEmail?: string }) {
  const colors = useThemePalette();

  function openSupport(issue: SupportIssue) {
    const url = buildSupportMailto({ issue, accountEmail: userEmail });
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.prompt('ส่งอีเมลหา support ได้ที่:', SUPPORT_EMAIL);
      }
    });
  }

  return (
    <ThemedView type="backgroundElement" style={safetyStyles.card}>
      <View style={safetyStyles.headerRow}>
        <FiHelpCircle size={18} color={Accent.base} />
        <ThemedText type="defaultSemiBold">ส่งข้อมูลให้ support ครบในครั้งเดียว</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={safetyStyles.subtitle}>
        เลือกหัวข้อ แล้วแอปจะเปิดอีเมลพร้อมช่อง Account email, Purchase email และ Payhip Order ID
      </ThemedText>
      <View style={safetyStyles.supportGrid}>
        <SupportLinkRow
          colors={colors}
          icon="mail"
          title="Restore / Unlock"
          hint="ซื้อแล้วไม่ขึ้นในแอป"
          onPress={() => openSupport('restore')}
        />
        <SupportLinkRow
          colors={colors}
          icon="package"
          title="Payhip / Download"
          hint="หา receipt หรือ PDF ไม่เจอ"
          onPress={() => openSupport('download')}
        />
        <SupportLinkRow
          colors={colors}
          icon="shield"
          title="Library backup"
          hint="import/export หรือข้อมูลในเครื่อง"
          onPress={() => openSupport('library-backup')}
        />
      </View>
    </ThemedView>
  );
}

function SupportLinkRow({
  colors,
  icon,
  title,
  hint,
  onPress,
}: {
  colors: typeof Colors.light;
  icon: 'mail' | 'package' | 'shield';
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const Icon = icon === 'mail' ? FiMail : icon === 'package' ? FiPackage : FiShield;
  const actionSurface = getSettingsActionSurface(colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`ติดต่อ support เรื่อง ${title}`}
      style={({ pressed }) => [
        safetyStyles.supportRow,
        { borderColor: actionSurface, backgroundColor: actionSurface },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon size={16} color={Accent.base} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      <FiExternalLink size={15} color={Accent.base} />
    </Pressable>
  );
}

const safetyStyles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Radii.sm,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  subtitle: { lineHeight: 18 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  lineText: {
    flex: 1,
    lineHeight: 18,
  },
  backupActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
  backupButton: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  restorePreview: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.two,
    marginTop: Spacing.one,
  },
  restorePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  restoreActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  restoreButton: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  supportGrid: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
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
  onSignOut: () => Promise<unknown>;
  onRefresh: () => Promise<void>;
}) {
  const colors = useThemePalette();

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
            สิทธิ์ปลดล็อก {entitlementCount} รายการ
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
    state === 'done'    ? 'ตรวจแล้ว' :
                          'ตรวจสิทธิ์ / Restore';

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
          scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
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
          scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
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
  /* Ghost kanji backdrop — sticky, anchored to ThemedView root.
     Matches Shop's muted treatment (secondary surface, lower opacity
     than Browse main page). */
  ghostKanji: {
    position: 'absolute',
    top: 40,
    right: -20,
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 200,
    lineHeight: 200,
    opacity: 0.04,
    zIndex: 0,
    pointerEvents: 'none',
  } as any,
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
    /* Round-5 P0 — GPT verdict "long list flatten · 32-40px section
       gaps ช่วยเยอะมาก". Bumped from 16 → 32 so each section (บัญชี ·
       ธีม · การ์ด · ซิงค์ · เกี่ยวกับ) sits in its own slot. */
    gap: Spacing.six,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.two },
  section: { gap: Spacing.two },
  sectionLabel: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  /* Sub-group head inside a section — mono editorial style, paired with
     "// PREFIX · ไทย" pattern. Used to separate Quiz card group from
     Learn card group under the same "การ์ด" section. */
  cardGroupHead: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: Accent.base,
    marginTop: Spacing.one,
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
    gap: Spacing.two,
  },
  howToHelpRow: {
    marginTop: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '82%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modalTitlePip: {
    width: 7,
    height: 7,
    backgroundColor: Accent.base,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
    marginTop: -4,
    marginRight: -4,
  },
  /* Badge toggle vertical padding trimmed ~25% per GPT polish round
     2026-05-27. Row was visually heavier than the visibility settings
     beside it; lighter Y padding restores hierarchy. */
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
});
