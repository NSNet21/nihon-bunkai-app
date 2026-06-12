import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { FiX } from 'react-icons/fi';

import { CustomTermCreateFlow } from '@/components/custom-term-create-flow';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import type { Deck } from '@/data/types';

export function CustomTermCreateModal({
  visible,
  decks,
  onClose,
  onCreated,
}: {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = useThemePalette();
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          onPress={(event: any) => event.stopPropagation?.()}
          style={[styles.panel, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="defaultSemiBold">เพิ่มคำศัพท์ใหม่</ThemedText>
              <ThemedText type="small" style={{ color: Accent.base }}>User Library · Custom Deck</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="ปิดหน้าต่างเพิ่มคำศัพท์"
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}>
              <FiX size={18} color={colors.text} />
            </Pressable>
          </View>
          <CustomTermCreateFlow
            decks={decks}
            variant="modal"
            onCreated={onCreated}
            onOpenCreated={({ deckId, entryId }) => {
              onClose();
              router.push(`/deck/${deckId}/term/${entryId}` as never);
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    borderWidth: 1,
    borderTopWidth: 3,
    borderTopColor: Accent.base,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  header: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  closeButton: {
    padding: Spacing.two,
  },
});
