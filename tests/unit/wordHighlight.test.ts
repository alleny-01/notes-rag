import { describe, expect, it } from "vitest";
import {
  findWordRange,
  rectsForWordRange,
  type WordBox,
} from "../../src/components/SourceViewer/wordHighlight";

const words: WordBox[] = [
  ["A", 0.1, 0.1, 0.03, 0.03],
  ["red-black", 0.14, 0.1, 0.11, 0.03],
  ["balanced", 0.26, 0.1, 0.08, 0.03],
  ["tree", 0.35, 0.1, 0.05, 0.03],
  ["keeps", 0.1, 0.16, 0.06, 0.03],
  ["operations", 0.17, 0.16, 0.1, 0.03],
  ["O(log", 0.28, 0.16, 0.07, 0.03],
  ["n)", 0.36, 0.16, 0.03, 0.03],
  ["café", 0.1, 0.22, 0.05, 0.03],
  ["notes", 0.16, 0.22, 0.06, 0.03],
];

describe("word highlights", () => {
  it("finds exact claims and returns line-aware rectangles", () => {
    const range = findWordRange(
      words,
      "A red black balanced tree keeps operations",
    );
    expect(range).toEqual({ startWord: 0, endWord: 5 });
    const rects = rectsForWordRange(words, range!);
    expect(rects).toHaveLength(2);
    expect(
      rects.every(
        (rect) =>
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.left + rect.width <= 1 &&
          rect.top + rect.height <= 1,
      ),
    ).toBe(true);
  });

  it("matches punctuation, accents, and near claims with an intervening word", () => {
    expect(findWordRange(words, "O log n")).toEqual({
      startWord: 6,
      endWord: 7,
    });
    expect(findWordRange(words, "cafe notes")).toEqual({
      startWord: 8,
      endWord: 9,
    });
    expect(findWordRange(words, "A red black tree keeps operations")).toEqual({
      startWord: 0,
      endWord: 5,
    });
  });

  it("returns null for unrelated claims", () => {
    expect(findWordRange(words, "a completely unrelated passage")).toBeNull();
  });
});
