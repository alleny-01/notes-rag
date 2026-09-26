import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { pdfRuntimeIsSupported, pdfRuntimeMessage } from "../../lib/pdfCompatibility";
import type { ExtractedDocument, ExtractedPage } from "./extractText";

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function readFileArrayBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Your browser could not read this file."));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Your browser returned an invalid PDF file."));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * PDF.js lives only in this lazy module. TXT and Markdown uploads never load
 * or evaluate this dependency, which keeps them safe from PDF-runtime issues.
 */
export async function extractPdfText(file: File): Promise<ExtractedDocument> {
  if (!pdfRuntimeIsSupported()) throw new Error(pdfRuntimeMessage());

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFileArrayBuffer(file)) }).promise;
    const pages: ExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizeText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
      if (text) pages.push({ pageNumber, text });
    }

    if (!pages.length) {
      throw new Error("This PDF has no selectable text. NotesRAG currently supports text-based PDFs only.");
    }

    return {
      pages,
      normalizedText: pages.map((page) => page.text).join("\n\n"),
      pageCount: pdf.numPages,
    };
  } catch (error) {
    console.error("NotesRAG PDF extraction failed", {
      error,
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    if (error instanceof Error && error.message.includes("no selectable text")) throw error;
    throw new Error(`NotesRAG could not read this PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}
