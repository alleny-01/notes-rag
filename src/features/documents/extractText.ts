import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export type ExtractedPage = { pageNumber: number; text: string };

export type ExtractedDocument = {
  pages: ExtractedPage[];
  normalizedText: string;
  pageCount: number;
};

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractPdfText(file: File): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizeText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    if (text) pages.push({ pageNumber, text });
  }

  if (!pages.length) throw new Error("This PDF has no selectable text. NotesRAG currently supports text-based PDFs only.");
  return { pages, normalizedText: pages.map((page) => page.text).join("\n\n"), pageCount: pdf.numPages };
}

export async function extractText(file: File): Promise<ExtractedDocument> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return extractPdfText(file);
  const text = normalizeText(await file.text());
  if (!text) throw new Error("This note is empty. Add text and try again.");
  return { pages: [{ pageNumber: 1, text }], normalizedText: text, pageCount: 1 };
}

export async function createContentHash(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}