import path from "node:path";
import { createRequire } from "node:module";

export type WordBox = [
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
];
export type RenderedPage = {
  pageNumber: number;
  width: number;
  height: number;
  jpeg: Buffer;
  debugPng?: Buffer;
  words: WordBox[];
  text: string;
};

const RENDER_SCALE = 1.6;
const JPEG_QUALITY = 82;
const require = createRequire(import.meta.url);
// Load canvas through CommonJS too: PDF.js does the same internally, and its
// Path2D instances must come from the exact same native module instance.
const canvas = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
const { createCanvas } = canvas;
if (!globalThis.DOMMatrix)
  globalThis.DOMMatrix = canvas.DOMMatrix as unknown as typeof DOMMatrix;
if (!globalThis.Path2D)
  globalThis.Path2D = canvas.Path2D as unknown as typeof Path2D;
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
// PDF.js' Node reader passes this string to fs.readFile, so it must be a
// filesystem path using a forward-slash terminator (not a file: URL).
const standardFonts = `${path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts").replaceAll("\\", "/")}/`;

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function hasSelectableText(
  pdf: Awaited<ReturnType<typeof openPdf>>,
) {
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    try {
      const content = await page.getTextContent();
      const text = normalizeText(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
      if (text) return true;
    } finally {
      page.cleanup();
    }
  }
  return false;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 100000) / 100000));
}

export async function preloadPdfWorker() {
  const runtime = globalThis as typeof globalThis & { pdfjsWorker?: unknown };
  if (!runtime.pdfjsWorker)
    runtime.pdfjsWorker =
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
}

export function openPdf(bytes: Uint8Array) {
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    standardFontDataUrl: standardFonts,
  } as Parameters<typeof pdfjs.getDocument>[0] & { isEvalSupported: boolean })
    .promise;
}

export async function renderPage(
  pdf: Awaited<ReturnType<typeof openPdf>>,
  pageNumber: number,
  options?: { debugWordBoxes?: boolean },
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: canvas as never,
      canvasContext: context as never,
      viewport,
    }).promise;

    const base = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const words: WordBox[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = pdfjs.Util.transform(base.transform, item.transform);
      const fontHeight = Math.hypot(transform[2], transform[3]);
      const left = transform[4];
      const top = transform[5] - fontHeight;
      const totalWidth = item.width * base.scale;
      const length = item.str.length;
      for (const match of item.str.matchAll(/\S+/g)) {
        const start = ((match.index ?? 0) / length) * totalWidth;
        const end =
          (((match.index ?? 0) + match[0].length) / length) * totalWidth;
        words.push([
          match[0],
          clamp((left + start) / base.width),
          clamp(top / base.height),
          clamp((end - start) / base.width),
          clamp(fontHeight / base.height),
        ]);
      }
    }

    const debugPng = options?.debugWordBoxes
      ? (() => {
          context.strokeStyle = "rgba(116, 66, 170, 0.9)";
          context.lineWidth = 2;
          for (const [, x, y, width, height] of words)
            context.strokeRect(
              x * canvas.width,
              y * canvas.height,
              width * canvas.width,
              height * canvas.height,
            );
          return canvas.toBuffer("image/png");
        })()
      : undefined;

    return {
      pageNumber,
      width: canvas.width,
      height: canvas.height,
      jpeg: canvas.toBuffer("image/jpeg", JPEG_QUALITY),
      debugPng,
      words,
      text: normalizeText(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      ),
    };
  } finally {
    page.cleanup();
  }
}
