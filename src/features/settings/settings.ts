export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "system" | "on" | "off";
export type TextSize = "s" | "m" | "l";
export type AnswerStyle = "concise" | "balanced" | "detailed";
export type UserSettings = {
  theme: ThemePreference;
  reduceMotion: MotionPreference;
  textSize: TextSize;
  answerStyle: AnswerStyle;
  tour?: { source?: boolean; question?: boolean; citation?: boolean };
};

export const defaultSettings: UserSettings = {
  theme: "system",
  reduceMotion: "system",
  textSize: "m",
  answerStyle: "balanced",
  tour: {},
};
export function mergeSettings(
  value: Partial<UserSettings> | null | undefined,
): UserSettings {
  return {
    ...defaultSettings,
    ...value,
    tour: { ...defaultSettings.tour, ...(value?.tour ?? {}) },
  };
}
export function resolveMotionPreference(
  value: MotionPreference,
  systemReduced: boolean,
) {
  return value === "on" || (value === "system" && systemReduced);
}
export function localResetTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}
export function nextUtcMidnight() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}
