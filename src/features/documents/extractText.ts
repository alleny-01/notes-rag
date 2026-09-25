import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { pdfRuntimeIsSupported, pdfRuntimeMessage } from "../../lib/pdfCompatibility";

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

async function readFileArrayBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return readWithFileReader(file, "array-buffer") as Promise<ArrayBuffer>;
}

async function extractPdfText(file: File): Promise<ExtractedDocument> {
  if (!pdfRuntimeIsSupported()) throw new Error(pdfRuntimeMessage());
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const data = new Uint8Array(await readFileArrayBuffer(file));
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
  } catch (error) {
    if (error instanceof Error && error.message.includes("no selectable text")) throw error;
    throw new Error("NotesRAG could not read this PDF on this device. Make sure it is a text-based PDF and try again.");
  }
}

export async function extractText(file: File): Promise<ExtractedDocument> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return extractPdfText(file);
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
