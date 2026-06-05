export type TermEditingFields = {
  t: string;
  d: string;
  p: string;
  e: string;
};

export type TermEditingSaveState = TermEditingFields & {
  editable: boolean;
  initial?: TermEditingFields;
};

export function normalizeTermEditingFields(fields: TermEditingFields): TermEditingFields {
  return {
    t: fields.t.trim(),
    d: fields.d.trim(),
    p: fields.p.trim(),
    e: fields.e.trim(),
  };
}

export function canSaveTermEditingForm(input: TermEditingSaveState): boolean {
  if (!input.editable) return false;
  const normalized = normalizeTermEditingFields(input);
  if (!normalized.t || !normalized.d) return false;
  if (!input.initial) return true;
  const initial = normalizeTermEditingFields(input.initial);
  return normalized.t !== initial.t
    || normalized.d !== initial.d
    || normalized.p !== initial.p
    || normalized.e !== initial.e;
}
