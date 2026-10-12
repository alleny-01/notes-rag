export type WordBox = [
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
];
type Token = { value: string; wordIndex: number };
export type WordRange = { startWord: number; endWord: number };
export type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function claimTokens(value: string) {
  return (value.match(/[\p{L}\p{N}]+/gu) ?? []).map(normalizeToken);
}

export function buildTokens(words: WordBox[]): Token[] {
  return words.flatMap(([text], wordIndex) =>
    (text.match(/[\p{L}\p{N}]+/gu) ?? []).map((value) => ({
      value: normalizeToken(value),
      wordIndex,
    })),
  );
}

function exactRange(source: Token[], claim: string): WordRange | null {
  const target = claimTokens(claim);
  if (target.length < 2) return null;
  for (let start = 0; start <= source.length - target.length; start += 1) {
    if (source[start].value !== target[0]) continue;
    if (!target.every((word, offset) => source[start + offset]?.value === word))
      continue;
    return {
      startWord: source[start].wordIndex,
      endWord: source[start + target.length - 1].wordIndex,
    };
  }
  return null;
}

function nearRange(source: Token[], claim: string): WordRange | null {
  const target = claimTokens(claim);
  if (target.length < 4) return null;
  let best: { start: number; end: number; score: number } | null = null;
  for (
    let claimStart = 0;
    claimStart < Math.min(7, target.length);
    claimStart += 1
  ) {
    for (let sourceStart = 0; sourceStart < source.length; sourceStart += 1) {
      if (source[sourceStart].value !== target[claimStart]) continue;
      let cursor = sourceStart;
      let first = sourceStart;
      let last = sourceStart;
      let matched = 0;
      for (
        let targetIndex = claimStart;
        targetIndex < target.length;
        targetIndex += 1
      ) {
        const limit = Math.min(source.length, cursor + 13);
        let found = -1;
        for (let index = cursor; index < limit; index += 1)
          if (source[index].value === target[targetIndex]) {
            found = index;
            break;
          }
        if (found < 0) continue;
        if (!matched) first = found;
        last = found;
        matched += 1;
        cursor = found + 1;
      }
      const coverage = matched / target.length;
      const span = last - first + 1;
      if (coverage < 0.88 || span > target.length * 1.35 + 6) continue;
      const score = matched * 3 - span * 0.12 - claimStart * 0.4;
      if (!best || score > best.score)
        best = { start: first, end: last, score };
    }
  }
  return best
    ? {
        startWord: source[best.start].wordIndex,
        endWord: source[best.end].wordIndex,
      }
    : null;
}

export function findWordRange(words: WordBox[], claim: string) {
  const tokens = buildTokens(words);
  return exactRange(tokens, claim) ?? nearRange(tokens, claim);
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function rectsForWordRange(
  words: WordBox[],
  range: WordRange,
): HighlightRect[] {
  const selected = words.slice(range.startWord, range.endWord + 1);
  const lines: WordBox[][] = [];
  for (const word of selected) {
    const line = lines.at(-1);
    if (
      line &&
      Math.abs(line[0][2] - word[2]) < Math.max(line[0][4], word[4]) * 0.5
    )
      line.push(word);
    else lines.push([word]);
  }
  return lines.map((line) => {
    const left = Math.min(...line.map((word) => word[1]));
    const right = Math.max(...line.map((word) => word[1] + word[3]));
    const top = Math.min(...line.map((word) => word[2]));
    const bottom = Math.max(...line.map((word) => word[2] + word[4]));
    const verticalPad = (bottom - top) * 0.1;
    const horizontalPad = 0.002;
    const paddedLeft = clamp(left - horizontalPad);
    const paddedTop = clamp(top - verticalPad);
    const paddedRight = clamp(right + horizontalPad);
    const paddedBottom = clamp(bottom + verticalPad);
    return {
      left: paddedLeft,
      top: paddedTop,
      width: paddedRight - paddedLeft,
      height: paddedBottom - paddedTop,
    };
  });
}
