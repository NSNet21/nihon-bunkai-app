import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiCheck, FiFolder, FiPlus, FiSearch, FiSlash } from 'react-icons/fi';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import {
  DEFAULT_IMPORT_SECTION,
  filterImportDestinationGroups,
  filterImportDestinationSections,
  normalizeImportDestination,
  type ImportDestinationGroupOption,
} from '@/lib/import-export/import-destination';

type DestinationValue = {
  group: string;
  section: string;
};

export function CustomTermDestinationPicker({
  groups,
  current,
  busy,
  onChange,
}: {
  groups: ImportDestinationGroupOption[];
  current: DestinationValue;
  busy: boolean;
  onChange: (value: DestinationValue) => void;
}) {
  const colors = useThemePalette();
  const [groupQuery, setGroupQuery] = useState('');
  const [sectionQuery, setSectionQuery] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newSection, setNewSection] = useState(DEFAULT_IMPORT_SECTION);

  const normalized = normalizeImportDestination(current);
  const selectedGroup = groups.find((group) => !group.disabled && group.label === normalized.group);
  const visibleGroups = useMemo(
    () => filterImportDestinationGroups(groups, groupQuery),
    [groups, groupQuery],
  );
  const visibleSections = useMemo(
    () => selectedGroup ? filterImportDestinationSections(selectedGroup, sectionQuery) : [],
    [selectedGroup, sectionQuery],
  );
  const groupDraft = groupQuery.trim();
  const sectionDraft = sectionQuery.trim();

  function apply(value: Partial<DestinationValue>) {
    onChange(normalizeImportDestination({ ...normalized, ...value }));
  }

  function chooseGroup(group: ImportDestinationGroupOption) {
    if (busy || group.disabled) return;
    const firstSection = group.sections.find((section) => !section.disabled)?.label ?? DEFAULT_IMPORT_SECTION;
    setGroupQuery('');
    setSectionQuery('');
    apply({ group: group.label, section: firstSection });
  }

  function chooseSection(section: { label: string; disabled?: boolean }) {
    if (busy || section.disabled) return;
    setSectionQuery('');
    apply({ section: section.label });
  }

  function typeNewGroup(value: string) {
    setNewGroup(value);
    if (value.trim()) {
      apply({ group: value, section: newSection.trim() || DEFAULT_IMPORT_SECTION });
    }
  }

  function typeNewSection(value: string) {
    setNewSection(value);
    if (value.trim()) {
      apply({ section: value });
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.summaryIcon}>
          <FiFolder size={16} color={Accent.base} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText type="smallBold">เลือกที่เก็บคำ</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {normalized.group} / {normalized.section}
          </ThemedText>
        </View>
      </View>

      <View style={styles.block}>
        <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>GROUP</ThemedText>
        <DestinationInput
          value={groupQuery}
          disabled={busy}
          placeholder="ค้นหา group เดิม"
          icon
          onChangeText={setGroupQuery}
        />
        <ScrollView
          style={[styles.list, { borderColor: colors.border }]}
          keyboardShouldPersistTaps="handled"
          {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'custom-term-destination-group' } } as any) : null)}>
          {visibleGroups.map((group) => (
            <ChoiceRow
              key={group.key}
              label={group.label}
              meta={group.disabled ? 'Official Source · ใช้เป็นที่เก็บคำไม่ได้' : `${group.sections.length} sections`}
              selected={!group.disabled && group.label === normalized.group}
              disabled={busy || Boolean(group.disabled)}
              onPress={() => chooseGroup(group)}
            />
          ))}
        </ScrollView>
        <View style={[styles.createPanel, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
          <View style={styles.createHead}>
            <FiPlus size={15} color={Accent.base} />
            <ThemedText type="smallBold" style={{ color: Accent.base }}>สร้าง group ใหม่</ThemedText>
          </View>
          <DestinationInput
            value={newGroup}
            disabled={busy}
            placeholder={groupDraft || 'ชื่อ group ใหม่'}
            onChangeText={typeNewGroup}
          />
        </View>
      </View>

      <View style={styles.block}>
        <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>SECTION</ThemedText>
        <DestinationInput
          value={sectionQuery}
          disabled={busy || !selectedGroup}
          placeholder={selectedGroup ? 'ค้นหา section เดิม' : 'เลือก group เดิม หรือสร้าง group ใหม่ก่อน'}
          icon
          onChangeText={setSectionQuery}
        />
        {selectedGroup ? (
          <ScrollView
            style={[styles.list, { borderColor: colors.border }]}
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'custom-term-destination-section' } } as any) : null)}>
            {visibleSections.map((section) => (
              <ChoiceRow
                key={section.key}
                label={section.label}
                meta={section.disabled ? 'Official Source · ใช้ไม่ได้' : undefined}
                selected={!section.disabled && section.label === normalized.section}
                disabled={busy || Boolean(section.disabled)}
                onPress={() => chooseSection(section)}
              />
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.createPanel, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
          <View style={styles.createHead}>
            <FiPlus size={15} color={Accent.base} />
            <ThemedText type="smallBold" style={{ color: Accent.base }}>สร้าง section ใหม่</ThemedText>
          </View>
          <DestinationInput
            value={newSection}
            disabled={busy}
            placeholder={sectionDraft || DEFAULT_IMPORT_SECTION}
            onChangeText={typeNewSection}
          />
        </View>
      </View>
    </View>
  );
}

function ChoiceRow({
  label,
  meta,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  meta?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed, hovered }: any) => [
        styles.choice,
        {
          borderBottomColor: colors.border,
          backgroundColor: selected ? 'rgba(224, 32, 44, 0.07)' : hovered ? colors.surface2 : 'transparent',
          opacity: disabled ? 0.48 : 1,
        },
        pressed && !disabled && { opacity: 0.72 },
      ]}>
      {disabled ? <FiSlash size={15} color={colors.textHint} /> : selected ? <FiCheck size={15} color={Accent.base} /> : <View style={styles.emptyIcon} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText type="smallBold" numberOfLines={1}>{label}</ThemedText>
        {meta ? <ThemedText type="small" themeColor="textHint" numberOfLines={1}>{meta}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

function DestinationInput({
  value,
  disabled,
  placeholder,
  icon,
  onChangeText,
}: {
  value: string;
  disabled: boolean;
  placeholder: string;
  icon?: boolean;
  onChangeText: (value: string) => void;
}) {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.inputShell,
        {
          borderColor: focused ? Accent.base : colors.border,
          backgroundColor: colors.background,
          opacity: disabled ? 0.6 : 1,
        },
        focused && styles.inputFocused,
      ]}>
      {icon ? <FiSearch size={14} color={focused ? Accent.base : colors.textHint} /> : null}
      <TextInput
        value={value}
        editable={!disabled}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textHint}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  summary: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  summaryIcon: {
    width: 28,
    alignItems: 'center',
  },
  block: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  list: {
    maxHeight: 176,
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  choice: {
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 15,
  },
  createPanel: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  createHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  inputShell: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inputFocused: {
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(224, 32, 44, 0.14)' } as any) : null),
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text' } as any) : null),
  },
});
