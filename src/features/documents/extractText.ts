export type ExtractedPage = { pageNumber: number; text: string };

export type ExtractedDocument = {
  pages: ExtractedPage[];
  normalizedText: string;
  pageCount: number;
};

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function readWithFileReader(file: File, mode: "text" | "array-buffer") {
  return new Promise<string | ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Your browser could not read this file."));
    reader.onload = () => resolve(reader.result ?? (mode === "text" ? "" : new ArrayBuffer(0)));
    if (mode === "text") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

async function readFileText(file: File) {
  if (typeof file.text === "function") return file.text();
  return readWithFileReader(file, "text") as Promise<string>;
}

export async function extractText(file: File): Promise<ExtractedDocument> {
  const text = normalizeText(await readFileText(file));
  if (!text) throw new Error("This note is empty. Add text and try again.");
  return { pages: [{ pageNumber: 1, text }], normalizedText: text, pageCount: 1 };
}

export async function createContentHash(text: string) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser does not support secure document hashing. Update the browser and try again.");
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
