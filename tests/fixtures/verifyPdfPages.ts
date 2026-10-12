import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  hasSelectableText,
  openPdf,
  preloadPdfWorker,
  renderPage,
} from "../../api/_lib/pdfPages.ts";
import {
  findWordRange,
  rectsForWordRange,
} from "../../src/components/SourceViewer/wordHighlight.ts";

const { createCanvas } = createRequire(import.meta.url)(
  "@napi-rs/canvas",
) as typeof import("@napi-rs/canvas");

async function makeTextPdf() {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const text of [
    "Page one has red black tree evidence.",
    "",
    "Page three has modular software evidence.",
  ]) {
    const page = document.addPage([612, 792]);
    if (text)
      page.drawText(text, {
        x: 72,
        y: 680,
        size: 16,
        font,
        color: rgb(0, 0, 0),
      });
  }
  return document.save();
}

async function makeImageOnlyPdf() {
  const canvas = createCanvas(240, 120);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#222";
  context.fillRect(28, 34, 184, 42);
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const image = await document.embedJpg(canvas.toBuffer("image/jpeg", 82));
  page.drawImage(image, { x: 72, y: 500, width: 468, height: 234 });
  return document.save();
}

await preloadPdfWorker();
const pdf = await openPdf(new Uint8Array(await makeTextPdf()));
assert.equal(pdf.numPages, 3);
const first = await renderPage(pdf, 1, { debugWordBoxes: true });
const blank = await renderPage(pdf, 2);
const third = await renderPage(pdf, 3, { debugWordBoxes: true });
assert.ok(first.jpeg.byteLength > 1_000);
assert.ok(first.width > 500 && first.height > 700);
assert.match(first.text, /red black tree evidence/);
assert.equal(blank.text, "");
assert.equal(blank.words.length, 0);
assert.match(third.text, /modular software evidence/);
assert.ok(
  first.words.every(
    ([, x, y, width, height]) =>
      x >= 0 &&
      y >= 0 &&
      width >= 0 &&
      height >= 0 &&
      x + width <= 1 &&
      y + height <= 1,
  ),
);
const range = findWordRange(
  first.words,
  "Page one has red black tree evidence",
);
if (!range)
  throw new Error("Expected a word range for the first-page citation.");
const rects = rectsForWordRange(first.words, range);
assert.ok(rects.length > 0);
assert.ok(
  rects.every(
    (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= 0 &&
      rect.top >= 0 &&
      rect.left + rect.width <= 1 &&
      rect.top + rect.height <= 1,
  ),
);

const imageOnly = await openPdf(new Uint8Array(await makeImageOnlyPdf()));
assert.equal(await hasSelectableText(imageOnly), false);

const output = path.resolve("tmp-verify");
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "page-1.jpg"), first.jpeg);
await writeFile(path.join(output, "page-3.jpg"), third.jpeg);
await writeFile(path.join(output, "page-1-word-boxes.png"), first.debugPng!);
await writeFile(path.join(output, "page-3-word-boxes.png"), third.debugPng!);
// pdf.js keeps a native worker/canvas handle open on Windows. This fixture has
// completed all assertions and file writes, so exit directly instead of asking
// Node to tear down that known-unstable native test process.
process.stdout.write(
  `${JSON.stringify({ pages: 3, blankPage: true, imageOnly: true, citationRoundTrip: true })}\n`,
);
process.exit(0);
