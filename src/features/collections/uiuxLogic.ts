export function showStarterQuestions(
  messageCount: number,
  hasReadyDocument: boolean,
) {
  return messageCount === 0 && hasReadyDocument;
}

export function chatStage(isSubmitting: boolean, hasStreamedContent: boolean) {
  if (!isSubmitting) return "idle" as const;
  return hasStreamedContent ? ("writing" as const) : ("searching" as const);
}

export function shouldFocusChatShortcut(
  key: string,
  target: EventTarget | null,
) {
  if (key !== "/") return false;
  const element = target instanceof HTMLElement ? target : null;
  return !element?.matches("input, textarea, [contenteditable=true]");
}
