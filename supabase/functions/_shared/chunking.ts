export type SourcePage = { pageNumber: number; text: string };

export type Chunk = {
  content: string;
  pageNumber: number;
  chunkIndex: number;
};

const TARGET_TOKENS = 400;
const OVERLAP_TOKENS = 60;

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function unitsForPage(text: string) {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return (paragraphs.length ? paragraphs : [text])
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((unit) => unit.trim())
    .filter(Boolean);
}

/**
 * Uses paragraph/sentence boundaries when possible, then a word window as the
 * fallback. Token counts are deliberately approximate: the frontend has no
 * server tokenizer and Voyage accepts inputs far larger than these chunks.
 */
export function chunkPages(pages: SourcePage[]): Chunk[] {
  const output: Chunk[] = [];

  for (const page of pages) {
    const pageWords = unitsForPage(page.text).flatMap(words);
    let start = 0;

    while (start < pageWords.length) {
      const end = Math.min(start + TARGET_TOKENS, pageWords.length);
      const content = pageWords.slice(start, end).join(" ").trim();
      if (content) {
        output.push({
          content,
          pageNumber: page.pageNumber,
          chunkIndex: output.length,
        });
      }
      if (end === pageWords.length) break;
      start = Math.max(start + 1, end - OVERLAP_TOKENS);
    }
  }

  return output;
}
