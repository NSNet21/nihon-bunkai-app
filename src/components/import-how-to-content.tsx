import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiArchive, FiUpload } from 'react-icons/fi';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import {
  IMPORT_HOW_TO_STEPS,
  IMPORT_SCHEMA_HEADERS,
  type ImportHowToStep,
} from '@/lib/import-export/import-how-to';

const HOW_TO_IMAGES = {
  'example-table': require('@/assets/images/import-how-to/01-google-sheets-csv-example-table.jpeg'),
  'download-menu': require('@/assets/images/import-how-to/02-google-sheets-download-as-csv.jpg'),
} as const;

type ImportHowToContentProps = {
  busy?: boolean;
  showImportActions?: boolean;
  onImportOne?: () => void;
  onImportBatch?: () => void;
};

export function ImportHowToContent({
  busy = false,
  showImportActions = false,
  onImportOne,
  onImportBatch,
}: ImportHowToContentProps) {
  const colors = useThemePalette();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <View style={[styles.schemaStrip, { borderColor: colors.border }]}>
        {IMPORT_SCHEMA_HEADERS.map((header) => (
          <ThemedText key={header} type="smallBold" style={styles.schemaToken}>
            {header}
          </ThemedText>
        ))}
      </View>
      <View style={[styles.note, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <ThemedText type="smallBold">นำเข้าโดยตรงจาก CSV/ZIP</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ไม่ใช่ Google Drive sync · content ที่ import เองยังอยู่เฉพาะเครื่องนี้ ควร export backup ก่อนล้าง browser หรือย้ายเครื่อง
        </ThemedText>
      </View>
      {IMPORT_HOW_TO_STEPS.map((step) => (
        <HowToStep key={step.key} step={step} />
      ))}
      {showImportActions ? (
        <View style={styles.ctas}>
          <Pressable
            onPress={onImportOne}
            disabled={busy || !onImportOne}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: Accent.base },
              (busy || !onImportOne) && { opacity: 0.45 },
              pressed && { opacity: 0.72 },
            ]}>
            <FiUpload size={16} color="#fff" />
            <ThemedText type="smallBold" style={{ color: '#fff' }}>เลือก CSV/ZIP</ThemedText>
          </Pressable>
          <Pressable
            onPress={onImportBatch}
            disabled={busy || !onImportBatch}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: colors.border },
              (busy || !onImportBatch) && { opacity: 0.45 },
              pressed && { opacity: 0.72 },
            ]}>
            <FiArchive size={16} color={Accent.base} />
            <ThemedText type="smallBold" style={{ color: Accent.base }}>Batch import</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function HowToStep({ step }: { step: ImportHowToStep }) {
  const colors = useThemePalette();
  return (
    <View style={[styles.step, { borderColor: colors.border }]}>
      <ThemedText type="smallBold" style={{ color: Accent.base }}>{step.eyebrow}</ThemedText>
      <ThemedText type="defaultSemiBold">{step.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{step.body}</ThemedText>
      {step.image ? (
        <View style={[styles.imageFrame, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Image
            source={HOW_TO_IMAGES[step.image]}
            style={styles.image}
            contentFit="contain"
            transition={120}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexShrink: 1,
    minHeight: 0,
    maxHeight: '100%',
  },
  inner: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  schemaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.two,
  },
  schemaToken: {
    minWidth: 40,
    textAlign: 'center',
    color: '#fff',
    backgroundColor: Accent.base,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  note: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.two,
    gap: 2,
  },
  step: {
    gap: Spacing.one,
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
  },
  imageFrame: {
    marginTop: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1.85,
  },
  ctas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  primary: {
    flexGrow: 1,
    minWidth: 142,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  secondary: {
    flexGrow: 1,
    minWidth: 142,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
