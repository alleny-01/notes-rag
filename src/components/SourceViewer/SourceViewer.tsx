import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, LoaderCircle, SearchX } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "../../lib/supabaseClient";
import type { ChatCitation, Collection, CollectionDocument } from "../../features/collections/types/domain";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type SourceViewerProps = {
  collection: Collection;
  citation: ChatCitation | null;
};

type SourceState =
  | { status: "loading"; url?: undefined; text?: undefined }
  | { status: "ready"; url?: string; text?: string }
  | { status: "error"; message: string };

function isPdf(document: CollectionDocument) {
  return document.filename.toLocaleLowerCase().endsWith(".pdf");
}

function SourceLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-[420px] place-items-center px-6 text-center">
      <div>
        <LoaderCircle className="mx-auto size-5 animate-[spin_1.35s_linear_infinite] text-[var(--purple)] motion-reduce:animate-none" strokeWidth={1} />
        <p className="mt-3 text-[11px] text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}

function CitedPassage({ citation }: { citation: ChatCitation | null }) {
  if (!citation) {
    return (
      <div className="mx-4 mt-4 bg-[rgba(95,61,130,0.06)] px-3.5 py-3 text-[12px] leading-5 text-[var(--body)]">
        Select a citation in the conversation to place the retrieved passage beside its original document.
      </div>
    );
  }

  return (
    <aside className="mx-4 mt-4 bg-[rgba(156,115,200,0.14)] px-3.5 py-3 shadow-[inset_3px_0_0_var(--purple)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--purple)]">
        Cited passage{citation.pageNumber ? ` · page ${citation.pageNumber}` : ""}
      </p>
      <p className="mt-2 max-h-28 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden font-[var(--serif)] text-[14px] leading-6 text-[#4d3a56]">
        {citation.content}
      </p>
    </aside>
  );
}

function PdfSource({
  document,
  citation,
  sourceUrl,
}: {
  document: CollectionDocument;
  citation: ChatCitation | null;
  sourceUrl: string;
}) {
  const [pageCount, setPageCount] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    setPdfError("");
    setPageCount(undefined);
    setPageNumber(citation?.documentId === document.id && citation.pageNumber ? citation.pageNumber : 1);
  }, [citation?.chunkId, citation?.documentId, citation?.pageNumber, document.id]);

  const resolvedPage = Math.min(Math.max(pageNumber, 1), pageCount ?? pageNumber);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CitedPassage citation={citation?.documentId === document.id ? citation : null} />
      <div className="mt-4 flex items-center justify-between gap-3 px-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
          {pageCount ? `Page ${resolvedPage} of ${pageCount}` : "Opening PDF"}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            disabled={resolvedPage <= 1}
            className="grid size-7 place-items-center rounded-md text-[var(--body)] transition hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} strokeWidth={1} />
          </button>
          <button
            type="button"
            onClick={() => setPageNumber((current) => Math.min(pageCount ?? current, current + 1))}
            disabled={!pageCount || resolvedPage >= pageCount}
            className="grid size-7 place-items-center rounded-md text-[var(--body)] transition hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next page"
          >
            <ChevronRight size={15} strokeWidth={1} />
          </button>
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-auto bg-[#e9e1d4] px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pdfError ? (
          <div className="grid min-h-[320px] place-items-center bg-[var(--cream)] px-6 text-center">
            <div>
              <SearchX size={20} className="mx-auto text-[var(--signal)]" strokeWidth={1} />
              <p className="mt-3 text-[12px] leading-5 text-[var(--body)]">{pdfError}</p>
            </div>
          </div>
        ) : (
          <Document
            file={sourceUrl}
            loading={<SourceLoading label="Opening your PDF…" />}
            onLoadSuccess={({ numPages }) => {
              setPageCount(numPages);
              setPageNumber((current) => Math.min(Math.max(current, 1), numPages));
            }}
            onLoadError={() => setPdfError("We could not render this PDF. You can still use its retrieved passages in chat.")}
            className="mx-auto w-fit"
          >
            <Page
              pageNumber={resolvedPage}
              width={Math.min(720, typeof window === "undefined" ? 720 : Math.max(280, window.innerWidth > 1024 ? window.innerWidth * 0.32 : window.innerWidth - 64))}
              renderAnnotationLayer={false}
              renderTextLayer
              className="bg-white shadow-[0_12px_26px_rgba(66,47,39,0.16)]"
            />
          </Document>
        )}
      </div>
    </div>
  );
}

function TextSource({ document, citation, sourceText }: { document: CollectionDocument; citation: ChatCitation | null; sourceText: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CitedPassage citation={citation?.documentId === document.id ? citation : null} />
      <div className="mt-4 min-h-0 flex-1 overflow-auto bg-[#e9e1d4] px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <pre className="mx-auto max-w-3xl whitespace-pre-wrap bg-white px-6 py-7 font-[var(--serif)] text-[14px] leading-7 text-[#574a45] shadow-[0_12px_26px_rgba(66,47,39,0.12)] sm:px-8">
          {sourceText}
        </pre>
      </div>
    </div>
  );
}

export function SourceViewer({ collection, citation }: SourceViewerProps) {
  const sourceDocuments = useMemo(
    () => collection.documents.filter((document) => document.status === "ready"),
    [collection.documents],
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const [source, setSource] = useState<SourceState>({ status: "loading" });
  const selectedDocument = sourceDocuments.find((document) => document.id === selectedDocumentId) ?? sourceDocuments[0];

  useEffect(() => {
    if (citation?.documentId) setSelectedDocumentId(citation.documentId);
  }, [citation?.documentId]);

  useEffect(() => {
    if (!selectedDocument) return;
    let active = true;
    setSource({ status: "loading" });
    const load = async () => {
      if (isPdf(selectedDocument)) {
        const { data, error } = await supabase.storage
          .from("notes-documents")
          .createSignedUrl(selectedDocument.storagePath, 60 * 60);
        if (!active) return;
        if (error || !data?.signedUrl) {
          setSource({ status: "error", message: error?.message ?? "We could not open this document." });
          return;
        }
        setSource({ status: "ready", url: data.signedUrl });
        return;
      }

      const { data, error } = await supabase.storage.from("notes-documents").download(selectedDocument.storagePath);
      if (!active) return;
      if (error || !data) {
        setSource({ status: "error", message: error?.message ?? "We could not open this note." });
        return;
      }
      setSource({ status: "ready", text: await data.text() });
    };
    void load();
    return () => { active = false; };
  }, [selectedDocument?.id, selectedDocument?.storagePath]);

  if (!selectedDocument) {
    return (
      <section className="grid min-h-[420px] place-items-center bg-[#f5f0e8] p-8 text-center text-[#332c2d]">
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e9dfd1] text-[var(--purple)]"><FileText size={20} strokeWidth={1} /></div>
          <h2 className="mt-4 font-[var(--serif)] text-[15px] font-light leading-none tracking-[-0.055em]">No notes to read yet.</h2>
          <p className="mt-3 max-w-xs text-[13px] leading-6 text-[#756b64]">Add a text-based PDF or note before opening a conversation.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col bg-[#f5f0e8] text-[#332c2d]">
      <div className="flex min-h-12 items-center gap-3 bg-[rgba(223,212,197,0.45)] px-4">
        <FileText size={14} className="shrink-0" strokeWidth={1} />
        <label htmlFor="source-document" className="sr-only">Source document</label>
        <select
          id="source-document"
          value={selectedDocument.id}
          onChange={(event) => setSelectedDocumentId(event.target.value)}
          className="min-w-0 flex-1 truncate bg-transparent text-[11px] text-[#776d65] outline-none"
        >
          {sourceDocuments.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}
        </select>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#91857a]">Source</span>
      </div>
      {source.status === "loading" && <SourceLoading label="Opening your source…" />}
      {source.status === "error" && (
        <div className="grid min-h-[420px] place-items-center px-6 text-center"><p className="max-w-xs text-[12px] leading-5 text-[var(--signal)]">{source.message}</p></div>
      )}
      {source.status === "ready" && isPdf(selectedDocument) && source.url && <PdfSource document={selectedDocument} citation={citation} sourceUrl={source.url} />}
      {source.status === "ready" && !isPdf(selectedDocument) && <TextSource document={selectedDocument} citation={citation} sourceText={source.text ?? ""} />}
    </section>
  );
}
