import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileText,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { navigate } from "../../../app/navigation";
import { Spinner } from "../../../components/ui/spinner";
import type { Collection } from "../types/domain";

type Props = {
  collection: Collection;
  onAddDocument: (collectionId: string, file: File) => Promise<void>;
  onRemoveDocument: (documentId: string) => Promise<void>;
};
const maxSize = 20 * 1024 * 1024;
const supported = ["application/pdf", "text/plain", "text/markdown"];
const size = (bytes: number) =>
  bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;

function documentState(document: Collection["documents"][number]) {
  if (document.status === "ready") return "Ready to chat";
  if (document.status === "failed") return "Indexing failed";
  if (document.status === "embedding") {
    const total = document.chunkCount ?? 0;
    const complete = document.embeddedChunkCount ?? 0;
    return total
      ? `Indexing ${complete}/${total} passages`
      : "Preparing passages";
  }
  return "Queued for indexing";
}

export function UploadPage({ collection, onAddDocument, onRemoveDocument }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [removingDocumentId, setRemovingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const add = (file?: File) => {
    if (!file) return;
    setError("");
    if (
      (!supported.includes(file.type) && !/\.(pdf|txt|md)$/i.test(file.name)) ||
      file.size > maxSize
    ) {
      setError(
        file.size > maxSize
          ? "This file is larger than 20 MB. Split it into smaller files and try again."
          : "Choose a text-based PDF, TXT, or Markdown file.",
      );
      return;
    }
    setChecking(true);
    void onAddDocument(collection.id, file)
      .catch((uploadError: unknown) =>
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "We could not upload this document.",
        ),
      )
      .finally(() => setChecking(false));
  };
  const remove = async (documentId: string) => {
    setError("");
    setRemovingDocumentId(documentId);
    try {
      await onRemoveDocument(documentId);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "We could not remove this document.");
    } finally {
      setRemovingDocumentId(null);
    }
  };
  const documents = collection.documents;
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:px-9">
      <section className="max-w-2xl">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--purple)]">
          {collection.name}
        </p>
        <p className="mt-5 max-w-xl text-[12px] leading-7 text-[var(--body)]">
          Upload text-based PDFs or plain-text notes. Each document stays scoped
          to this collection.
        </p>
      </section>
      <section className="mt-10 w-full">
        <div>
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              add(event.target.files?.[0])
            }
          />
          <div
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(false);
              add(event.dataTransfer.files[0]);
            }}
            className={`grid min-h-72 place-items-center border border-dashed p-7 text-center shadow-[0_0_0_rgba(66,47,39,0)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(66,47,39,0.08)] ${dragging ? "border-[var(--purple)] bg-[rgba(95,61,130,0.08)]" : "border-[var(--line)] bg-[var(--cream)] hover:border-[var(--purple)]"}`}
          >
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--lilac)] text-[var(--purple)]">
                <UploadCloud size={23} strokeWidth={1} />
              </div>
              <h2 className="mt-5 font-[var(--serif)] text-[15px] font-light leading-none tracking-[-0.045em]">
                Drop a document here.
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-[13px] leading-6 text-[var(--body)]">
                Or choose a file from your computer. PDFs must contain
                selectable text; scanned PDFs are not supported yet.
              </p>
              <button
                type="button"
                disabled={checking}
                onClick={() => input.current?.click()}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-white px-3.5 shadow-[0_5px_14px_rgba(66,47,39,0.07)] text-[12px] font-medium text-[var(--ink)] transition duration-200 ease-out hover:-translate-y-px hover:border-[var(--purple)] hover:text-[var(--purple)] active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
              >
                {checking ? (
                  <>
                    <Spinner className="size-[15px] animate-spin" /> <span className="text-sm">Checking
                    document…</span>
                  </>
                ) : (
                  <>
                    <FileText size={15} strokeWidth={1} />{" "}
                    <span className="text-sm">Choose file</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div
              className="mt-3 flex items-start gap-2 border border-[#e0b3b3] bg-[#fff7f7] p-3 text-[12px] leading-5 text-[#8f3d42]"
              role="alert"
            >
              <XCircle size={16} className="mt-0.5 shrink-0" strokeWidth={1} />
              <span>{error}</span>
            </div>
          )}
          {documents.length > 0 && (
            <div className="mt-8 bg-white shadow-[0_14px_30px_rgba(66,47,39,0.06)]">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[12px] font-semibold">Added documents</p>
                <span className="text-[11px] text-[var(--muted)]">
                  {documents.length} saved
                </span>
              </div>
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-[var(--cream)] last:border-b-0"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--paper)] text-[var(--purple)]">
                    <FileText size={15} strokeWidth={1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {document.filename}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                      {size(document.size)} · {documentState(document)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {document.status === "ready" ? (
                      <CheckCircle2 size={17} className="text-[#63945a]" strokeWidth={1} />
                    ) : document.status === "failed" ? (
                      <CircleAlert size={17} className="text-[#a45353]" strokeWidth={1} />
                    ) : (
                      <Spinner className="size-4 animate-spin text-[var(--purple)]" />
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(document.id)}
                      disabled={removingDocumentId !== null || checking}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[10px] text-[var(--muted)] transition hover:bg-[#fff1f1] hover:text-[var(--signal)] disabled:cursor-wait disabled:opacity-50"
                      aria-label={`Remove ${document.filename}`}
                    >
                      {removingDocumentId === document.id ? <Spinner className="size-3.5 animate-spin" /> : <Trash2 size={14} strokeWidth={1} />}
                      <span className="text-sm">{removingDocumentId === document.id ? "Removing…" : "Remove"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="mt-10 flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-5 text-[var(--muted)]">
          {documents.length
            ? "Your document is stored. Its indexing status updates here as it becomes chat-ready."
            : "Add at least one document before starting a chat."}
        </p>
        <button
          type="button"
          disabled={!documents.length}
          onClick={() =>
            navigate({ name: "workspace", collectionId: collection.id })
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--purple)] px-4 text-[13px] font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--purple-dark)] active:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#b7a4c5]"
        >
          <span className="text-sm">Open workspace </span>{" "}
          <ArrowRight size={16} />
        </button>
      </section>

      <section className="bg-[var(--paper)] mt-5 px-5 py-5 shadow-[0_12px_28px_rgba(66,47,39,0.05)]">
          <p className="text-[11px] font-semibold tracking-[0.11em] text-[var(--purple)]">
            File support
          </p>
          <ul className="mt-4 grid gap-3 text-[12px] leading-5 text-[var(--body)]">
            <li>
              <strong className="font-medium text-[var(--ink)]">
                Text-layer PDFs
              </strong>
              <br />
              <p className="text-[11px] tracking-wide">
                Lecture handouts, readings, exported articles.
              </p>
            </li>
            <li>
              <strong className="font-medium text-[var(--ink)]">
                Plain-text notes
              </strong>
              <br />
              <p className="text-[11px] tracking-wide">
                {" "}
                and Markdown notes work too.
              </p>
            </li>
            <li>
              <strong className="font-medium text-[var(--ink)]">
                Not yet supported
              </strong>
              <br />
              <p className="text-[11px] tracking-wide">
                Scans, image-only PDFs, and handwriting need OCR first.
              </p>
            </li>
          </ul>
        </section>
    </main>
  );
}
