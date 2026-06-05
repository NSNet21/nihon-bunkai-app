export type DeckManagementFields = {
  title: string;
  group?: string;
  section?: string;
};

export function normalizeDeckManagementFields(fields: DeckManagementFields): DeckManagementFields {
  return {
    title: fields.title.trim(),
    group: cleanOptional(fields.group),
    section: cleanOptional(fields.section),
  };
}

export function canSaveDeckManagementForm(input: DeckManagementFields & {
  editable: boolean;
  initial?: DeckManagementFields;
}): boolean {
  if (!input.editable) return false;
  const current = normalizeDeckManagementFields(input);
  if (!current.title) return false;
  if (!input.initial) return true;
  const initial = normalizeDeckManagementFields(input.initial);
  return current.title !== initial.title ||
    current.group !== initial.group ||
    current.section !== initial.section;
}

function cleanOptional(value: string | undefined) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}
