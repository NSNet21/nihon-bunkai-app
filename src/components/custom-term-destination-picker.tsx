import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiCheck, FiChevronDown, FiFolder, FiMapPin, FiPlus, FiSearch, FiSlash } from 'react-icons/fi';

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
  const [groupOpen, setGroupOpen] = useState(true);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);

  const normalized = normalizeImportDestination(current);
  const selectedGroup = groups.find((group) => !group.disabled && group.label === normalized.group);
  const visibleGroups = useMemo(
    () => filterImportDestinationGroups(groups, groupQuery),
    [groups, groupQuery],
  );
  const visibleSections = useMemo(
    () => {
      const userSections = selectedGroup ? filterImportDestinationSections(selectedGroup, sectionQuery) : [];
      const normalizedQuery = sectionQuery.trim().toLowerCase();
      const officialSections = uniqueOfficialSections(groups)
        .filter((section) => !normalizedQuery || section.label.toLowerCase().includes(normalizedQuery));
      return [...userSections, ...officialSections];
    },
    [groups, selectedGroup, sectionQuery],
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
    setCreateGroupOpen(false);
    setCreateSectionOpen(false);
    apply({ group: group.label, section: firstSection });
  }

  function chooseSection(section: { label: string; disabled?: boolean }) {
    if (busy || section.disabled) return;
    setSectionQuery('');
    setCreateSectionOpen(false);
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
      <CollapsibleBlock
        title="GROUP"
        summary={normalized.group}
        open={groupOpen}
        onToggle={() => setGroupOpen((value) => !value)}>
        <DestinationInput value={groupQuery} disabled={busy} placeholder="ค้นหา Group เดิม" icon onChangeText={setGroupQuery} />
        <ScrollView
          style={[styles.list, { borderColor: colors.border }]}
          keyboardShouldPersistTaps="handled"
          {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'custom-term-destination-group' } } as any) : null)}>
          {visibleGroups.map((group) => (
            <ChoiceRow
              key={group.key}
              label={group.label}
              meta={group.disabled ? 'Official Source · ไม่สามารถเพิ่มข้อมูลในส่วนนี้ได้' : `${group.sections.length} sections`}
              selected={!group.disabled && group.label === normalized.group}
              disabled={busy || Boolean(group.disabled)}
              onPress={() => chooseGroup(group)}
            />
          ))}
        </ScrollView>
        <CreatePanel
          label="สร้าง Group ใหม่"
          open={createGroupOpen}
          disabled={busy}
          onToggle={() => setCreateGroupOpen((value) => !value)}>
          <DestinationInput value={newGroup} disabled={busy} placeholder={groupDraft || 'ระบุชื่อ Group ใหม่'} onChangeText={typeNewGroup} />
        </CreatePanel>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="SECTION"
        summary={normalized.section}
        open={sectionOpen}
        onToggle={() => setSectionOpen((value) => !value)}>
        <DestinationInput
          value={sectionQuery}
          disabled={busy || !selectedGroup}
          placeholder={selectedGroup ? 'ค้นหา Section เดิม' : 'โปรดเลือก Group หรือสร้าง Group ใหม่ก่อน'}
          icon
          onChangeText={setSectionQuery}
        />
        <ScrollView
          style={[styles.list, { borderColor: colors.border }]}
          keyboardShouldPersistTaps="handled"
          {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'custom-term-destination-section' } } as any) : null)}>
          {visibleSections.map((section) => (
            <ChoiceRow
              key={section.key}
              label={section.label}
              meta={section.disabled ? 'Official Source · ไม่สามารถเลือกใช้ได้' : undefined}
              selected={!section.disabled && section.label === normalized.section}
              disabled={busy || Boolean(section.disabled)}
              onPress={() => chooseSection(section)}
            />
          ))}
        </ScrollView>
        <CreatePanel
          label="สร้าง Section ใหม่"
          open={createSectionOpen}
          disabled={busy}
          onToggle={() => setCreateSectionOpen((value) => !value)}>
          <DestinationInput value={newSection} disabled={busy} placeholder={sectionDraft || DEFAULT_IMPORT_SECTION} onChangeText={typeNewSection} />
        </CreatePanel>
      </CollapsibleBlock>

      <View style={[styles.pathSummary, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
        <FiMapPin size={15} color={Accent.base} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText type="small" themeColor="textHint">ตำแหน่งจัดเก็บปลายทาง</ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {normalized.group} / {normalized.section}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function uniqueOfficialSections(groups: readonly ImportDestinationGroupOption[]) {
  const seen = new Set<string>();
  const sections: { key: string; label: string; disabled?: boolean }[] = [];
  for (const group of groups) {
    if (!group.disabled) continue;
    for (const section of group.sections) {
      const key = `official-section:${section.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sections.push({ key, label: section.label, disabled: true });
    }
  }
  return sections;
}

function CollapsibleBlock({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const colors = useThemePalette();
  return (
    <View style={[styles.blockShell, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`คลิกเพื่อ ${open ? 'ย่อ' : 'ขยาย'} ข้อมูล ${title}`}
        style={({ pressed, hovered }: any) => [
          styles.blockHeader,
          { borderBottomColor: open ? colors.border : 'transparent', backgroundColor: hovered ? colors.surface2 : 'transparent' },
          pressed && { opacity: 0.72 },
        ]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>{title}</ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>{summary}</ThemedText>
        </View>
        <FiChevronDown
          size={15}
          color={colors.textHint}
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </Pressable>
      {open ? <View style={styles.blockBody}>{children}</View> : null}
    </View>
  );
}

function CreatePanel({
  label,
  open,
  disabled,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const colors = useThemePalette();
  return (
    <View style={[styles.createPanel, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        style={({ pressed }) => [styles.createHead, pressed && !disabled && { opacity: 0.72 }, disabled && { opacity: 0.52 }]}>
        <FiPlus size={15} color={Accent.base} />
        <ThemedText type="smallBold" style={{ color: Accent.base }}>{label}</ThemedText>
        <FiChevronDown
          size={14}
          color={Accent.base}
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : undefined }}
        />
      </Pressable>
      {open ? children : null}
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  blockShell: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  blockHeader: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  blockBody: {
    padding: Spacing.two,
    gap: Spacing.two,
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
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pathSummary: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
