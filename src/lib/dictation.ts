export function normalizeDictationAnswer(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('th');
}

export function checkDictationAnswer(answer: string, expected: string) {
  return normalizeDictationAnswer(answer) === normalizeDictationAnswer(expected);
}
