import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { FiExternalLink, FiPlus, FiShare2, FiSmartphone, FiX } from 'react-icons/fi';

import { PressableScale } from './pressable-scale';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Accent, Colors, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import { useHasHydrated } from '@/hooks/use-has-hydrated';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { getPwaShortcutMode, isIOSLikePlatform, type PwaShortcutMode } from '@/lib/pwa-shortcut';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PwaShortcutNudgeProps = {
  placement: 'browse' | 'settings';
};

const PWA_SHORTCUT_DISMISSED_KEY = 'pwa-shortcut-nudge-dismissed';
const MOBILE_TABLET_MAX_WIDTH = 1024;

export function PwaShortcutNudge({ placement }: PwaShortcutNudgeProps) {
  const colors = useThemePalette();
  const { width } = useWindowDimensions();
  const hasHydrated = useHasHydrated();
  const [dismissed, setDismissed] = usePersistedState(PWA_SHORTCUT_DISMISSED_KEY, false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [iosLike] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return isIOSLikePlatform(window.navigator);
  });
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');

    function updateStandalone() {
      setStandalone(Boolean(standaloneQuery?.matches || nav.standalone));
    }

    updateStandalone();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery?.addEventListener?.('change', updateStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery?.removeEventListener?.('change', updateStandalone);
    };
  }, []);

  const mode = useMemo<PwaShortcutMode>(() => {
    if (!hasHydrated || Platform.OS !== 'web') return 'hidden';
    return getPwaShortcutMode({
      standalone,
      canPromptInstall: !!installPrompt,
      isIOS: iosLike,
      isMobileLike: width <= MOBILE_TABLET_MAX_WIDTH,
    });
  }, [hasHydrated, installPrompt, iosLike, standalone, width]);

  const hiddenByBrowseDismiss = placement === 'browse' && dismissed;
  const isSettings = placement === 'settings';
  const actionLabel = 'เพิ่มไปยังหน้าจอหลัก';
  const instructionSubtitle = iosLike
    ? 'Safari เพิ่มเว็บแอปผ่านเมนูแชร์'
    : 'ใช้เมนูของเบราว์เซอร์เพื่อเพิ่มไอคอนของเว็บแอป';
  const instructionSteps = iosLike
    ? [
        'แตะปุ่มแชร์ในแถบเครื่องมือของเบราว์เซอร์',
        'เลือก เพิ่มไปยังหน้าจอหลัก',
        'เปิด Nihon Bunkai จากไอคอนใหม่',
      ]
    : [
        'เปิดเมนูของเบราว์เซอร์',
        'เลือก เพิ่มไปยังหน้าจอหลัก',
        'เปิด Nihon Bunkai จากไอคอนใหม่',
      ];

  const handlePrimary = useCallback(async () => {
    if (mode === 'instructions') {
      setInstructionsOpen(true);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDismissed(true);
    }
    setInstallPrompt(null);
  }, [installPrompt, mode, setDismissed]);

  if (mode === 'hidden' || hiddenByBrowseDismiss) return null;

  const actionButton = (
    <PressableScale
      onPress={handlePrimary}
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      scaleTo={0.98}
      opacityTo={0.9}
      style={[
        styles.primaryButton,
        isSettings && styles.settingsPrimaryButton,
        { backgroundColor: Accent.base },
      ]}>
      {mode === 'prompt' ? (
        <FiPlus size={15} color="#fff" strokeWidth={2.4} />
      ) : (
        <FiExternalLink size={15} color="#fff" strokeWidth={2.4} />
      )}
      <ThemedText type="smallBold" style={styles.primaryButtonLabel}>
        {actionLabel}
      </ThemedText>
    </PressableScale>
  );

  const card = (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        isSettings ? styles.settingsCard : styles.browseCard,
        {
          borderColor: isSettings ? colors.surface3 : colors.border,
          backgroundColor: isSettings ? colors.surface2 : colors.surface,
        },
      ]}>
      <View style={[styles.cardTopRow, isSettings && styles.settingsGrid]}>
        <View style={isSettings ? styles.settingsIconSlot : undefined}>
          <View
            style={[
              styles.iconShell,
              isSettings && styles.settingsIconShell,
              {
                borderColor: Accent.base,
                backgroundColor: isSettings ? Accent.base : Accent.bg,
              },
            ]}>
            <View style={styles.iconGlyph}>
              <FiSmartphone size={18} color={isSettings ? '#fff' : Accent.base} strokeWidth={2.4} />
            </View>
          </View>
        </View>
        <View style={[styles.copy, isSettings && styles.settingsCopy]}>
          <ThemedText type="defaultSemiBold">ติดตั้งเว็บแอป</ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={[styles.bodyCopy, isSettings && styles.settingsBodyCopy]}>
            เข้าใช้งาน Nihon Bunkai ได้ง่าย ๆ แค่แตะครั้งเดียวจากหน้าจอ
          </ThemedText>
          {isSettings ? actionButton : null}
        </View>
        {placement === 'browse' ? (
          <Pressable
            onPress={() => setDismissed(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="ซ่อนคำแนะนำการติดตั้งเว็บแอป"
            style={({ pressed }) => [styles.dismissButton, pressed && { opacity: 0.6 }]}>
            <FiX size={16} color={colors.textHint} />
          </Pressable>
        ) : null}
      </View>
      {!isSettings ? <View style={styles.actionRow}>{actionButton}</View> : null}
    </ThemedView>
  );

  return (
    <>
      {isSettings ? (
        <View style={styles.settingsSection}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            WEB APP
          </ThemedText>
          {card}
        </View>
      ) : card}
      <Modal
        visible={instructionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInstructionsOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setInstructionsOpen(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation?.()}
            style={[
              styles.modalPanel,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderTopColor: Accent.base,
              },
            ]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="defaultSemiBold">เพิ่ม Nihon Bunkai ไปยังหน้าจอหลัก</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {instructionSubtitle}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setInstructionsOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="ปิดคำแนะนำการเพิ่มไปยังหน้าจอหลัก"
                style={({ pressed }) => [styles.modalCloseButton, pressed && { opacity: 0.7 }]}>
                <FiX size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.steps}>
              <InstructionStep icon="share" label={instructionSteps[0]} colors={colors} />
              <InstructionStep icon="plus" label={instructionSteps[1]} colors={colors} />
              <InstructionStep icon="phone" label={instructionSteps[2]} colors={colors} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function InstructionStep({
  icon,
  label,
  colors,
}: {
  icon: 'share' | 'plus' | 'phone';
  label: string;
  colors: typeof Colors.light;
}) {
  const Icon = icon === 'share' ? FiShare2 : icon === 'plus' ? FiPlus : FiSmartphone;
  return (
    <View style={[styles.stepRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Icon size={16} color={Accent.base} />
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const webShadow = Platform.select({
  web: { boxShadow: '0 6px 16px rgba(20, 17, 14, 0.08)' } as unknown as ViewStyle,
  default: {},
});

const primaryButtonShadow = Platform.select({
  web: { boxShadow: '0 3px 8px rgba(224, 32, 44, 0.28)' } as unknown as ViewStyle,
  default: { elevation: 2 },
});

const settingsCardShadow = Platform.select({
  web: { boxShadow: 'none' } as unknown as ViewStyle,
  default: {},
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    ...webShadow,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  browseCard: {
    marginTop: Spacing.three,
  },
  settingsCard: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
    ...settingsCardShadow,
  },
  settingsSection: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  sectionLabel: {
    letterSpacing: 0.6,
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconShell: {
    width: 40,
    height: 40,
  },
  iconGlyph: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  settingsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  settingsIconSlot: {
    flexBasis: 64,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bodyCopy: {
    lineHeight: 18,
  },
  settingsBodyCopy: {
    textAlign: 'left',
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    ...primaryButtonShadow,
  },
  settingsPrimaryButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonLabel: {
    color: '#fff',
    letterSpacing: 0.1,
  },
  actionRow: {
    paddingLeft: 42,
    alignItems: 'flex-start',
  },
  dismissButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 17, 14, 0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: Radii.md,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: {
    gap: Spacing.two,
  },
  stepRow: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
