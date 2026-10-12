import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { loadUserSettings, saveUserSettings } from "../api";
import {
  defaultSettings,
  mergeSettings,
  resolveMotionPreference,
  type UserSettings,
} from "../settings";

const localKey = "notesrag:user-settings";
function localSettings() {
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(localKey) ?? "{}"));
  } catch {
    return defaultSettings;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(() =>
    typeof window === "undefined" ? defaultSettings : localSettings(),
  );
  const query = useQuery({
    queryKey: ["user-settings"],
    queryFn: loadUserSettings,
  });
  useEffect(() => {
    if (query.data) setSettings(query.data);
  }, [query.data]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.reduceMotion = String(
      resolveMotionPreference(
        settings.reduceMotion,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    );
    localStorage.setItem(localKey, JSON.stringify(settings));
  }, [settings]);
  const save = useMutation({ mutationFn: saveUserSettings });
  const update = (patch: Partial<UserSettings>) => {
    const next = mergeSettings({ ...settings, ...patch });
    setSettings(next);
    save.mutate(next);
  };
  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return useMemo(
    () => ({
      settings,
      update,
      isReduced: resolveMotionPreference(settings.reduceMotion, systemReduced),
      isSaving: save.isPending,
      error: query.error ?? save.error,
    }),
    [settings, systemReduced, save.isPending, query.error, save.error],
  );
}
