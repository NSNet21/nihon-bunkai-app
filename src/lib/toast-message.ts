export function formatToastText(message: string, actionLabel?: string): string {
  const cleanAction = actionLabel?.trim();
  return cleanAction ? `${message} · ${cleanAction}` : message;
}
