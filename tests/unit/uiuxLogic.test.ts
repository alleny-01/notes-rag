import { describe, expect, it } from "vitest";
import {
  chatStage,
  showStarterQuestions,
} from "../../src/features/collections/uiuxLogic";
import {
  mergeSettings,
  resolveMotionPreference,
} from "../../src/features/settings/settings";

describe("workspace UI logic", () => {
  it("only shows starter questions for an empty ready collection", () => {
    expect(showStarterQuestions(0, true)).toBe(true);
    expect(showStarterQuestions(1, true)).toBe(false);
    expect(showStarterQuestions(0, false)).toBe(false);
  });
  it("uses real chat stages", () => {
    expect(chatStage(true, false)).toBe("searching");
    expect(chatStage(true, true)).toBe("writing");
    expect(chatStage(false, false)).toBe("idle");
  });
  it("merges incomplete settings safely and resolves motion", () => {
    expect(mergeSettings({ theme: "dark" }).answerStyle).toBe("balanced");
    expect(resolveMotionPreference("on", false)).toBe(true);
    expect(resolveMotionPreference("system", true)).toBe(true);
    expect(resolveMotionPreference("off", true)).toBe(false);
  });
});
