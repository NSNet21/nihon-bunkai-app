import { forwardRef, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { FiCheckSquare, FiMinus, FiPlus, FiSearch, FiSquare } from 'react-icons/fi';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radii, Spacing } from '@/constants/theme';
import { useThemePalette } from '@/context/theme';
import {
  DEFAULT_IMPORT_SECTION,
  filterImportDestinationGroups,
  filterImportDestinationSections,
  type ImportDestinationGroupOption,
} from '@/lib/import-export/import-destination';

export function ImportDestinationPicker({
  groups,
  current,
  busy,
  title = 'เลือก import destination',
  showBack = true,
  onBack,
  onApply,
}: {
  groups: ImportDestinationGroupOption[];
  current: { group: string; section: string };
  busy: boolean;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onApply: (value: { group: string; section: string }) => void;
}) {
  const colors = useThemePalette();
  const [selectedGroupKey, setSelectedGroupKey] = useState(() => {
    const currentGroup = groups.find((group) => !group.disabled && group.label === current.group);
    const firstUserGroup = groups.find((group) => !group.disabled);
    return currentGroup?.key ?? firstUserGroup?.key ?? '';
  });
  const [selectedSectionKey, setSelectedSectionKey] = useState(() => {
    const group = groups.find((item) => item.key === selectedGroupKey);
    return group?.sections.find((section) => !section.disabled && section.label === current.section)?.key
      ?? group?.sections.find((section) => !section.disabled)?.key
      ?? '';
  });
  const [creatingGroup, setCreatingGroup] = useState(() => !groups.some((group) => !group.disabled));
  const [creatingSection, setCreatingSection] = useState(() => !groups.some((group) => !group.disabled));
  const [newGroup, setNewGroup] = useState('');
  const [newSection, setNewSection] = useState(DEFAULT_IMPORT_SECTION);
  const [groupQuery, setGroupQuery] = useState('');
  const [sectionQuery, setSectionQuery] = useState('');
  const [groupOptionsOpen, setGroupOptionsOpen] = useState(true);
  const [sectionOptionsOpen, setSectionOptionsOpen] = useState(true);
  const newGroupInputRef = useRef<TextInput>(null);
  const newSectionInputRef = useRef<TextInput>(null);

  const selectedGroup = groups.find((group) => group.key === selectedGroupKey);
  const selectedSection = selectedGroup?.sections.find((section) => !section.disabled && section.key === selectedSectionKey);
  const visibleGroups = filterImportDestinationGroups(groups, groupQuery);
  const visibleSections = selectedGroup ? filterImportDestinationSections(selectedGroup, sectionQuery) : [];
  const groupDraft = groupQuery.trim();
  const sectionDraft = sectionQuery.trim();
  const groupBlockMeta = creatingGroup
    ? `New · ${newGroup.trim() || 'ยังไม่ได้ตั้งชื่อ'}`
    : selectedGroup
      ? `${selectedGroup.label}${selectedGroup.disabled ? ' · Official Source' : ''}`
      : 'Create new group';
  const sectionBlockMeta = creatingGroup || creatingSection
    ? `New · ${newSection.trim() || DEFAULT_IMPORT_SECTION}`
    : selectedSection
      ? selectedSection.label
      : 'Create new section';
  const applyLabel = creatingGroup
    ? `Use ${newGroup.trim() || 'New group'} / ${newSection.trim() || DEFAULT_IMPORT_SECTION}`
    : creatingSection
      ? `Use ${selectedGroup?.label ?? current.group} / ${newSection.trim() || DEFAULT_IMPORT_SECTION}`
      : `Use ${selectedGroup?.label ?? current.group} / ${selectedSection?.label ?? DEFAULT_IMPORT_SECTION}`;

  function chooseGroup(group: ImportDestinationGroupOption) {
    if (group.disabled) return;
    setCreatingGroup(false);
    setSelectedGroupKey(group.key);
    setSelectedSectionKey(group.sections.find((section) => !section.disabled)?.key ?? '');
    setCreatingSection(false);
    setNewSection(DEFAULT_IMPORT_SECTION);
    setSectionQuery('');
    setGroupOptionsOpen(false);
    setSectionOptionsOpen(true);
  }

  function focusInput(ref: RefObject<TextInput | null>) {
    setTimeout(() => ref.current?.focus(), 60);
  }

  function startCreatingGroup(nextGroup = groupDraft) {
    setCreatingGroup(true);
    setCreatingSection(true);
    setNewGroup(nextGroup);
    setNewSection(sectionDraft || DEFAULT_IMPORT_SECTION);
    setGroupOptionsOpen(true);
    setSectionOptionsOpen(true);
    focusInput(newGroupInputRef);
  }

  function startCreatingSection(nextSection = sectionDraft || DEFAULT_IMPORT_SECTION) {
    setCreatingSection(true);
    setNewSection(nextSection);
    setSectionOptionsOpen(true);
    focusInput(newSectionInputRef);
  }

  function apply() {
    if (creatingGroup) {
      onApply({ group: newGroup, section: newSection });
      return;
    }
    if (creatingSection) {
      onApply({ group: selectedGroup?.label ?? current.group, section: newSection });
      return;
    }
    onApply({ group: selectedGroup?.label ?? current.group, section: selectedSection?.label ?? DEFAULT_IMPORT_SECTION });
  }

  return (
    <View style={styles.picker}>
      <PickerHeader title={title} showBack={showBack} onBack={onBack} />
      <View style={styles.destinationPickerGrid}>
        <View style={styles.destinationPickerColumn}>
          <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>GROUP</ThemedText>
          <CollapsiblePickerBlock
            title="Group options"
            meta={groupBlockMeta}
            open={groupOptionsOpen}
            onToggle={() => setGroupOptionsOpen((value) => !value)}
            collapsedAction={(
              <DestinationCreateRow
                label="Create new group"
                active={creatingGroup}
                disabled={busy}
                onPress={() => startCreatingGroup('')}
              />
            )}>
            <DestinationTextInput
              value={groupQuery}
              disabled={busy}
              onChangeText={setGroupQuery}
              placeholder="ค้นหา group หรือพิมพ์ชื่อใหม่"
              icon="search"
            />
            <ScrollView
              style={[styles.destinationPickerList, { borderColor: colors.border }]}
              {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'library-modal' } } as any) : null)}>
              {visibleGroups.map((group) => (
                <DestinationChoiceRow
                  key={group.key}
                  label={group.label}
                  meta={group.disabled ? `Official Source · ${group.sections.length} sections` : `${group.sections.length} sections`}
                  checked={!creatingGroup && selectedGroupKey === group.key}
                  disabled={busy || Boolean(group.disabled)}
                  onPress={() => chooseGroup(group)}
                />
              ))}
              <DestinationCreateRow
                label={groupDraft ? `Create group "${groupDraft}"` : 'Create new group'}
                active={creatingGroup}
                disabled={busy}
                onPress={() => startCreatingGroup()}
              />
            </ScrollView>
            {creatingGroup ? (
              <DestinationTextInput
                ref={newGroupInputRef}
                value={newGroup}
                disabled={busy}
                onChangeText={setNewGroup}
                placeholder="ชื่อ group ใหม่"
              />
            ) : null}
          </CollapsiblePickerBlock>
        </View>

        <View style={styles.destinationPickerColumn}>
          <ThemedText style={[styles.fieldLabel, { color: colors.textHint }]}>SECTION</ThemedText>
          {creatingGroup ? (
            <CollapsiblePickerBlock
              title="Section options"
              meta={sectionBlockMeta}
              open={sectionOptionsOpen}
              onToggle={() => setSectionOptionsOpen((value) => !value)}
              collapsedAction={(
                <DestinationCreateRow
                  label="Create new section"
                  active={creatingSection}
                  disabled={busy}
                  onPress={() => startCreatingSection('')}
                />
              )}>
              <ThemedText type="small" themeColor="textSecondary">
                Group ใหม่ยังไม่มี section เดิม ระบบจะสร้าง section ใหม่สำหรับ import รอบนี้
              </ThemedText>
              <DestinationTextInput
                ref={newSectionInputRef}
                value={newSection}
                disabled={busy}
                onChangeText={setNewSection}
                placeholder={DEFAULT_IMPORT_SECTION}
              />
            </CollapsiblePickerBlock>
          ) : selectedGroup ? (
            <CollapsiblePickerBlock
              title="Section options"
              meta={sectionBlockMeta}
              open={sectionOptionsOpen}
              onToggle={() => setSectionOptionsOpen((value) => !value)}
              collapsedAction={(
                <DestinationCreateRow
                  label="Create new section"
                  active={creatingSection}
                  disabled={busy}
                  onPress={() => startCreatingSection()}
                />
              )}>
              <DestinationTextInput
                value={sectionQuery}
                disabled={busy}
                onChangeText={setSectionQuery}
                placeholder="ค้นหา section หรือพิมพ์ชื่อใหม่"
                icon="search"
              />
              <ScrollView
                style={[styles.destinationPickerList, { borderColor: colors.border }]}
                {...(Platform.OS === 'web' ? ({ dataSet: { scroll: 'library-modal' } } as any) : null)}>
                {visibleSections.map((section) => (
                  <DestinationChoiceRow
                    key={section.key}
                    label={section.label}
                    meta={section.disabled ? 'Official Source · เลือกไม่ได้' : undefined}
                    checked={!creatingSection && selectedSectionKey === section.key}
                    disabled={busy || Boolean(section.disabled)}
                    onPress={() => {
                      if (section.disabled) return;
                      setCreatingSection(false);
                      setSelectedSectionKey(section.key);
                      setSectionOptionsOpen(false);
                    }}
                  />
                ))}
                <DestinationCreateRow
                  label={sectionDraft ? `Create section "${sectionDraft}"` : 'Create new section'}
                  active={creatingSection}
                  disabled={busy}
                  onPress={() => startCreatingSection()}
                />
              </ScrollView>
            </CollapsiblePickerBlock>
          ) : (
            <View style={styles.destinationCreatePanel}>
              <ThemedText type="small" themeColor="textSecondary">เลือก group ก่อน แล้ว section จะขึ้นตาม group นั้น</ThemedText>
            </View>
          )}
          {creatingSection && !creatingGroup ? (
            <DestinationTextInput
              ref={newSectionInputRef}
              value={newSection}
              disabled={busy}
              onChangeText={setNewSection}
              placeholder={DEFAULT_IMPORT_SECTION}
            />
          ) : null}
        </View>
      </View>
      <Pressable
        onPress={apply}
        disabled={busy || (creatingGroup && !newGroup.trim()) || Boolean(selectedGroup?.disabled)}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: Accent.base },
          (pressed || busy || (creatingGroup && !newGroup.trim()) || selectedGroup?.disabled) && { opacity: 0.65 },
        ]}>
        <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>{applyLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

function PickerHeader({ title, showBack, onBack }: { title: string; showBack: boolean; onBack?: () => void }) {
  return (
    <View style={styles.pickerHeader}>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      {showBack && onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.pickerBackButton, pressed && { opacity: 0.6 }]}>
          <ThemedText type="small" style={{ color: Accent.base }}>Back</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function DestinationChoiceRow({
  label,
  meta,
  checked,
  disabled,
  onPress,
}: {
  label: string;
  meta?: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  const Icon = checked ? FiCheckSquare : FiSquare;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.destinationChoiceRow,
        { borderBottomColor: colors.border, backgroundColor: checked ? 'rgba(224, 32, 44, 0.07)' : hovered ? colors.surface2 : 'transparent' },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.72 },
      ]}>
      <Icon size={16} color={checked ? Accent.base : colors.textHint} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText type="smallBold" numberOfLines={1}>{label}</ThemedText>
        {meta ? <ThemedText type="small" themeColor="textHint">{meta}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

const DestinationTextInput = forwardRef<TextInput, {
  value: string;
  disabled: boolean;
  placeholder: string;
  icon?: 'search';
  onChangeText: (value: string) => void;
}>(({ value, disabled, placeholder, icon, onChangeText }, ref) => {
  const colors = useThemePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.destinationInputShell,
        {
          borderColor: focused ? Accent.base : colors.border,
          backgroundColor: colors.background,
        },
        focused && styles.destinationInputShellFocused,
      ]}>
      {icon === 'search' ? <FiSearch size={15} color={focused ? Accent.base : colors.textHint} /> : null}
      <TextInput
        ref={ref}
        value={value}
        editable={!disabled}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textHint}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.destinationInput, { color: colors.text }]}
      />
    </View>
  );
});

DestinationTextInput.displayName = 'DestinationTextInput';

function DestinationCreateRow({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed, hovered }: any) => [
        styles.destinationChoiceRow,
        { borderBottomColor: colors.border, backgroundColor: active ? 'rgba(224, 32, 44, 0.07)' : hovered ? colors.surface2 : 'transparent' },
        pressed && { opacity: 0.72 },
      ]}>
      <FiPlus size={16} color={Accent.base} />
      <ThemedText type="smallBold" style={{ color: Accent.base }}>{label}</ThemedText>
    </Pressable>
  );
}

function CollapsiblePickerBlock({
  title,
  meta,
  open,
  onToggle,
  collapsedAction,
  children,
}: {
  title: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
  collapsedAction?: ReactNode;
  children: ReactNode;
}) {
  const colors = useThemePalette();
  return (
    <View style={[styles.destinationBlock, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'ย่อ' : 'ขยาย'} ${title}`}
        style={({ pressed, hovered }: any) => [
          styles.destinationBlockHeader,
          { borderBottomColor: open ? colors.border : 'transparent', backgroundColor: hovered ? colors.surface2 : 'transparent' },
          pressed && { opacity: 0.72 },
        ]}>
        {open ? <FiMinus size={16} color={colors.textHint} /> : <FiPlus size={16} color={colors.textHint} />}
        <View style={styles.destinationBlockTitle}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textHint" numberOfLines={1}>{meta}</ThemedText>
        </View>
      </Pressable>
      {open ? <View style={styles.destinationBlockBody}>{children}</View> : collapsedAction}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    flexShrink: 1,
    minHeight: 0,
    gap: Spacing.three,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pickerBackButton: {
    marginRight: Spacing.four,
  },
  destinationPickerGrid: {
    flexDirection: 'column',
    gap: Spacing.three,
  },
  destinationPickerColumn: {
    width: '100%',
    gap: Spacing.two,
  },
  destinationPickerList: {
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  destinationChoiceRow: {
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  destinationCreatePanel: {
    minHeight: 88,
    gap: Spacing.two,
  },
  destinationBlock: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  destinationBlockHeader: {
    minHeight: 48,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  destinationBlockTitle: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  destinationBlockBody: {
    gap: Spacing.two,
    padding: Spacing.two,
  },
  destinationInputShell: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  destinationInputShellFocused: {
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 0 3px rgba(224, 32, 44, 0.14)' } as any) : null),
  },
  destinationInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: Platform.select({ web: '"Sarabun", sans-serif', default: undefined }),
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radii.sm,
  },
});
