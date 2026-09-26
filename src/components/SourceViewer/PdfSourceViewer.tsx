import "../../lib/pdfCompatibility";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, SearchX } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { ChatCitation, CollectionDocument } from "../../features/collections/types/domain";

// Keep the viewer on the same compatibility-oriented PDF.js worker as upload extraction.
// The matching main-thread module is supplied by the Vite aliases in vite.config.ts.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Props = {
  sourceDocument: CollectionDocument;
  citation: ChatCitation | null;
  sourceUrl: string;
  onHighlightAnchorChange?: (anchor: HTMLElement | null) => void;
};

type TextToken = {
  value: string;
  node: Text;
  start: number;
  end: number;
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

function pageTokens(viewport: HTMLElement) {
  const textLayer = viewport.querySelector(".react-pdf__Page__textContent") ?? viewport;
  const tokens: TextToken[] = [];
  const walker = window.document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const value = node.textContent ?? "";
    for (const match of value.matchAll(/[\p{L}\p{N}]+/gu)) {
      const start = match.index ?? 0;
      tokens.push({ value: normalizeToken(match[0]), node, start, end: start + match[0].length });
    }
    current = walker.nextNode();
  }
  return tokens;
}

function rangeForExactClaim(source: TextToken[], target: string) {
  const claim = claimTokens(target);
  if (claim.length < 2) return null;
  for (let sourceIndex = 0; sourceIndex <= source.length - claim.length; sourceIndex += 1) {
    if (source[sourceIndex].value !== claim[0]) continue;
    if (!claim.every((word, offset) => source[sourceIndex + offset]?.value === word)) continue;
    const range = window.document.createRange();
    range.setStart(source[sourceIndex].node, source[sourceIndex].start);
    const last = source[sourceIndex + claim.length - 1];
    range.setEnd(last.node, last.end);
    return range;
  }
  return null;
}

function rangeForNearClaim(source: TextToken[], target: string) {
  const claim = claimTokens(target);
  if (claim.length < 4) return null;
  let best: { start: number; end: number; score: number } | null = null;
  const initialTargets = Math.min(7, claim.length);

  for (let claimStart = 0; claimStart < initialTargets; claimStart += 1) {
    for (let sourceStart = 0; sourceStart < source.length; sourceStart += 1) {
      if (source[sourceStart].value !== claim[claimStart]) continue;
      let cursor = sourceStart;
      let first = sourceStart;
      let last = sourceStart;
      let matched = 0;
      for (let targetIndex = claimStart; targetIndex < claim.length; targetIndex += 1) {
        const limit = Math.min(source.length, cursor + 13);
        let found = -1;
        for (let sourceIndex = cursor; sourceIndex < limit; sourceIndex += 1) {
          if (source[sourceIndex].value === claim[targetIndex]) {
            found = sourceIndex;
            break;
          }
        }
        if (found === -1) continue;
        if (matched === 0) first = found;
        last = found;
        matched += 1;
        cursor = found + 1;
      }
      const coverage = matched / claim.length;
      const span = last - first + 1;
      if (coverage < 0.88 || span > claim.length * 1.35 + 6) continue;
      const score = matched * 3 - span * 0.12 - claimStart * 0.4;
      if (!best || score > best.score) best = { start: first, end: last, score };
    }
  }

  if (!best) return null;
  const range = window.document.createRange();
  range.setStart(source[best.start].node, source[best.start].start);
  range.setEnd(source[best.end].node, source[best.end].end);
  return range;
}

function findClaimRange(viewport: HTMLElement, claim: string) {
  const source = pageTokens(viewport);
  return rangeForExactClaim(source, claim) ?? rangeForNearClaim(source, claim);
}

function SourceLoading() {
  return (
    <div className="grid min-h-[420px] place-items-center px-6 text-center">
      <div>
        <LoaderCircle className="mx-auto size-5 animate-[spin_1.35s_linear_infinite] text-[var(--purple)] motion-reduce:animate-none" strokeWidth={1} />
        <p className="mt-3 text-[11px] text-[var(--muted)]">Opening your PDF…</p>
      </div>
    </div>
  );
}

function CitedPassage({ citation }: { citation: ChatCitation | null }) {
  if (!citation) {
    return <div className="mx-4 mt-4 bg-[rgba(95,61,130,0.06)] px-3.5 py-3 text-[12px] leading-5 text-[var(--body)]">Select an inline citation in the conversation to locate its exact supporting text.</div>;
  }
  return (
    <aside className="mx-4 mt-4 min-w-0 bg-[rgba(156,115,200,0.14)] px-3.5 py-3 shadow-[inset_3px_0_0_var(--purple)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--purple)]">Cited evidence{citation.pageNumber ? ` · page ${citation.pageNumber}` : ""}</p>
      <p className="mt-2 break-words font-[var(--serif)] text-[14px] leading-6 text-[#4d3a56]">{citation.highlightText ?? citation.content.replace(/^\s*\d+\s+/, "")}</p>
    </aside>
  );
}

export function PdfSourceViewer({ sourceDocument, citation, sourceUrl, onHighlightAnchorChange }: Props) {
  const [pageCount, setPageCount] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState("");
  const [textLayerVersion, setTextLayerVersion] = useState(0);
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  const pageViewportRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPdfError("");
    setPageCount(undefined);
    setPageNumber(citation?.documentId === sourceDocument.id && citation.pageNumber ? citation.pageNumber : 1);
  }, [citation?.chunkId, citation?.documentId, citation?.pageNumber, sourceDocument.id]);

  const resolvedPage = Math.min(Math.max(pageNumber, 1), pageCount ?? pageNumber);
  const activeCitation = citation?.documentId === sourceDocument.id && citation.pageNumber === resolvedPage ? citation : null;
  const onRenderTextLayerSuccess = useCallback(() => setTextLayerVersion((version) => version + 1), []);

  useEffect(() => {
    const viewport = pageViewportRef.current;
    const highlightLayer = highlightLayerRef.current;
    if (!viewport || !highlightLayer) return;
    while (highlightLayer.firstChild) highlightLayer.removeChild(highlightLayer.firstChild);
    if (!activeCitation?.highlightText) {
      onHighlightAnchorChange?.(null);
      return;
    }
    const range = findClaimRange(viewport, activeCitation.highlightText);
    if (!range) {
      onHighlightAnchorChange?.(null);
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    let firstHighlight: HTMLElement | null = null;
    for (const rect of rects) {
      const highlight = window.document.createElement("span");
      highlight.style.position = "absolute";
      highlight.style.left = `${rect.left - viewportRect.left}px`;
      highlight.style.top = `${rect.top - viewportRect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.borderRadius = "2px";
      highlight.style.backgroundColor = "rgba(156, 115, 200, 0.42)";
      highlight.style.boxShadow = "0 0 0 1px rgba(95, 61, 130, 0.18)";
      highlightLayer.append(highlight);
      firstHighlight ??= highlight;
    }
    const firstRect = rects[0];
    if (!firstRect || !pdfScrollRef.current) {
      onHighlightAnchorChange?.(null);
      return;
    }
    onHighlightAnchorChange?.(firstHighlight);
    const scrollArea = pdfScrollRef.current;
    const destination = Math.max(0, firstRect.top - scrollArea.getBoundingClientRect().top + scrollArea.scrollTop - scrollArea.clientHeight * 0.32);
    const frame = window.requestAnimationFrame(() => scrollArea.scrollTo({ top: destination, behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeCitation?.chunkId, activeCitation?.highlightText, onHighlightAnchorChange, resolvedPage, textLayerVersion]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CitedPassage citation={activeCitation} />
      <p className="mt-4 px-4 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{pageCount ? `Source page ${resolvedPage} of ${pageCount}` : "Opening PDF"}</p>
      <div ref={pdfScrollRef} className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e9e1d4] px-4 py-5 [overscroll-behavior-x:none] touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pdfError ? (
          <div className="grid min-h-[320px] place-items-center bg-[var(--cream)] px-6 text-center"><div><SearchX size={20} className="mx-auto text-[var(--signal)]" strokeWidth={1} /><p className="mt-3 text-[12px] leading-5 text-[var(--body)]">{pdfError}</p></div></div>
        ) : (
          <div ref={pageViewportRef} className="relative mx-auto w-fit max-w-full">
            <Document file={sourceUrl} loading={<SourceLoading />} onLoadSuccess={({ numPages }) => { setPageCount(numPages); setPageNumber((current) => Math.min(Math.max(current, 1), numPages)); }} onLoadError={(error) => { console.error("NotesRAG PDF viewer load failed", error); setPdfError(`PDF viewer failed: ${error.message}`); }} className="mx-auto w-fit max-w-full">
              <Page pageNumber={resolvedPage} width={Math.min(720, typeof window === "undefined" ? 720 : Math.max(280, window.innerWidth > 1024 ? window.innerWidth * 0.32 : window.innerWidth - 64))} renderAnnotationLayer={false} renderTextLayer onRenderTextLayerSuccess={onRenderTextLayerSuccess} onRenderError={(error) => { console.error("NotesRAG PDF page render failed", error); setPdfError(`PDF render failed: ${error.message}`); }} className="bg-white shadow-[0_12px_26px_rgba(66,47,39,0.16)]" />
            </Document>
            <div ref={highlightLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" />
          </div>
        )}
      </div>
    </div>
  );
}
