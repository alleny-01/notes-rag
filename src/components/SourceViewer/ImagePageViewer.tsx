import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, RotateCcw, SearchX } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { backfillPdfPages } from "../../features/collections/api";
import type {
  ChatCitation,
  CollectionDocument,
} from "../../features/collections/types/domain";
import {
  findWordRange,
  rectsForWordRange,
  type WordBox,
} from "./wordHighlight";

type PageRow = {
  page_number: number;
  image_path: string;
  image_width: number;
  image_height: number;
  words: WordBox[];
};
type Props = {
  sourceDocument: CollectionDocument;
  citation: ChatCitation | null;
  onHighlightAnchorChange?: (anchor: HTMLElement | null) => void;
};

function CitedPassage({ citation }: { citation: ChatCitation | null }) {
  if (!citation)
    return (
      <div className="mx-4 mt-4 bg-[rgba(95,61,130,0.06)] px-3.5 py-3 text-[12px] leading-5 text-[var(--body)]">
        Select an inline citation in the conversation to locate its exact
        supporting text.
      </div>
    );
  return (
    <aside className="mx-4 mt-4 min-w-0 bg-[rgba(156,115,200,0.14)] px-3.5 py-3 shadow-[inset_3px_0_0_var(--purple)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--purple)]">
        Cited evidence
        {citation.pageNumber ? ` · page ${citation.pageNumber}` : ""}
      </p>
      <p className="mt-2 break-words font-[var(--serif)] text-[14px] leading-6 text-[#4d3a56]">
        {citation.highlightText ?? citation.content.replace(/^\s*\d+\s+/, "")}
      </p>
    </aside>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center bg-[var(--cream)] px-6 text-center">
      <div>
        <LoaderCircle
          className="mx-auto size-5 animate-[spin_1.35s_linear_infinite] text-[var(--purple)] motion-reduce:animate-none"
          strokeWidth={1}
        />
        <p className="mt-3 text-[11px] text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}

export function ImagePageViewer({
  sourceDocument,
  citation,
  onHighlightAnchorChange,
}: Props) {
  const [pageCount, setPageCount] = useState(sourceDocument.pageCount);
  const [pageNumber, setPageNumber] = useState(
    citation?.documentId === sourceDocument.id && citation.pageNumber
      ? citation.pageNumber
      : 1,
  );
  const [page, setPage] = useState<PageRow>();
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<
    "loading" | "backfill" | "error" | "ready"
  >("loading");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstHighlightRef = useRef<HTMLSpanElement>(null);
  const imageCache = useRef(new Map<number, { page: PageRow; url: string }>());

  const activeCitation =
    citation?.documentId === sourceDocument.id &&
    citation.pageNumber === pageNumber
      ? citation
      : null;
  const highlights = useMemo(
    () =>
      page && activeCitation?.highlightText
        ? (() => {
            const range = findWordRange(
              page.words,
              activeCitation.highlightText,
            );
            return range ? rectsForWordRange(page.words, range) : [];
          })()
        : [],
    [page, activeCitation?.highlightText],
  );

  useEffect(() => {
    if (citation?.documentId === sourceDocument.id && citation.pageNumber)
      setPageNumber(citation.pageNumber);
  }, [
    citation?.chunkId,
    citation?.documentId,
    citation?.pageNumber,
    sourceDocument.id,
  ]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setStatus("loading");
      setMessage("");
      const cached = imageCache.current.get(pageNumber);
      if (cached) {
        if (active) {
          setPage(cached.page);
          setImageUrl(cached.url);
          setStatus("ready");
        }
        return;
      }
      let { data, error } = await supabase
        .from("document_pages")
        .select("page_number,image_path,image_width,image_height,words")
        .eq("document_id", sourceDocument.id)
        .eq("page_number", pageNumber)
        .maybeSingle<PageRow>();
      if (!data && !error) {
        try {
          if (active) setStatus("backfill");
          const count = await backfillPdfPages(sourceDocument.id);
          if (!active) return;
          setPageCount(count);
          ({ data, error } = await supabase
            .from("document_pages")
            .select("page_number,image_path,image_width,image_height,words")
            .eq("document_id", sourceDocument.id)
            .eq("page_number", pageNumber)
            .maybeSingle<PageRow>());
        } catch (backfillError) {
          if (active) {
            setStatus("error");
            setMessage(
              backfillError instanceof Error
                ? backfillError.message
                : "We could not prepare this PDF for viewing.",
            );
          }
          return;
        }
      }
      if (!data || error) {
        if (active) {
          setStatus("error");
          setMessage(error?.message ?? "This PDF page is unavailable.");
        }
        return;
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from("notes-pages")
        .createSignedUrl(data.image_path, 3600);
      if (!signed?.signedUrl || signedError) {
        if (active) {
          setStatus("error");
          setMessage(
            signedError?.message ?? "We could not open this PDF page image.",
          );
        }
        return;
      }
      imageCache.current.set(pageNumber, { page: data, url: signed.signedUrl });
      if (active) {
        setPage(data);
        setImageUrl(signed.signedUrl);
        setStatus("ready");
      }
      const next = pageNumber + 1;
      if (pageCount && next <= pageCount && !imageCache.current.has(next)) {
        void supabase
          .from("document_pages")
          .select("page_number,image_path,image_width,image_height,words")
          .eq("document_id", sourceDocument.id)
          .eq("page_number", next)
          .maybeSingle<PageRow>()
          .then(async ({ data: nextPage }) => {
            if (!nextPage) return;
            const { data: nextUrl } = await supabase.storage
              .from("notes-pages")
              .createSignedUrl(nextPage.image_path, 3600);
            if (nextUrl?.signedUrl)
              imageCache.current.set(next, {
                page: nextPage,
                url: nextUrl.signedUrl,
              });
          });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [pageNumber, pageCount, reloadKey, sourceDocument.id]);

  useEffect(() => {
    if (
      !highlights.length ||
      !firstHighlightRef.current ||
      !scrollRef.current
    ) {
      onHighlightAnchorChange?.(null);
      return;
    }
    onHighlightAnchorChange?.(firstHighlightRef.current);
    const scrollArea = scrollRef.current;
    const target = firstHighlightRef.current.getBoundingClientRect();
    const destination = Math.max(
      0,
      target.top -
        scrollArea.getBoundingClientRect().top +
        scrollArea.scrollTop -
        scrollArea.clientHeight * 0.32,
    );
    const frame = window.requestAnimationFrame(() =>
      scrollArea.scrollTo({ top: destination, behavior: "smooth" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [highlights, onHighlightAnchorChange]);

  const retry = () => {
    imageCache.current.delete(pageNumber);
    setPage(undefined);
    setImageUrl("");
    setReloadKey((current) => current + 1);
  };
  const resolvedCount = pageCount ?? sourceDocument.pageCount;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CitedPassage citation={activeCitation} />
      <p className="mt-4 px-4 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
        {resolvedCount
          ? `Source page ${pageNumber} of ${resolvedCount}`
          : "Opening PDF"}
      </p>
      <div
        ref={scrollRef}
        className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e9e1d4] px-4 py-5 [overscroll-behavior-x:none] touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {status === "loading" || status === "backfill" ? (
          <Loading
            label={
              status === "backfill"
                ? "Preparing this PDF for viewing…"
                : "Opening your PDF…"
            }
          />
        ) : null}
        {status === "error" ? (
          <div className="grid min-h-[320px] place-items-center bg-[var(--cream)] px-6 text-center">
            <div>
              <SearchX
                size={20}
                className="mx-auto text-[var(--signal)]"
                strokeWidth={1}
              />
              <p className="mt-3 text-[12px] leading-5 text-[var(--body)]">
                {message}
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 inline-flex items-center gap-2 text-[12px] text-[var(--purple)]"
              >
                <RotateCcw size={14} strokeWidth={1} /> Retry
              </button>
            </div>
          </div>
        ) : null}
        {status === "ready" && page && imageUrl ? (
          <div className="relative mx-auto w-fit max-w-full">
            <img
              src={imageUrl}
              width={page.image_width}
              height={page.image_height}
              onError={() => {
                setStatus("error");
                setMessage("We could not load this PDF page image.");
              }}
              className="block h-auto w-full bg-white shadow-[0_12px_26px_rgba(66,47,39,0.16)]"
              alt={`Page ${pageNumber} of ${sourceDocument.filename}`}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[1]"
            >
              {highlights.map((rect, index) => (
                <span
                  key={`${rect.left}-${rect.top}-${index}`}
                  ref={index === 0 ? firstHighlightRef : undefined}
                  className="absolute rounded-[2px] bg-[rgba(156,115,200,0.42)] shadow-[0_0_0_1px_rgba(95,61,130,0.18)]"
                  style={{
                    left: `${rect.left * 100}%`,
                    top: `${rect.top * 100}%`,
                    width: `${rect.width * 100}%`,
                    height: `${rect.height * 100}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
