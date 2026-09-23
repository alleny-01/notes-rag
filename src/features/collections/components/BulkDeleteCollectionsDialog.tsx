import { useEffect, useId } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Spinner } from "../../../components/ui/spinner";

type BulkDeleteCollectionsDialogProps = {
  count: number;
  isDeleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function BulkDeleteCollectionsDialog({
  count,
  isDeleting,
  isOpen,
  onClose,
  onConfirm,
}: BulkDeleteCollectionsDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDeleting, isOpen, onClose]);

  if (!isOpen || count === 0) return null;

  const collectionLabel = count === 1 ? "collection" : "collections";

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Cancel bulk collection deletion"
        disabled={isDeleting}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(27,25,26,0.34)] backdrop-blur-[2px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[31rem] bg-[var(--cream)] p-5 shadow-[0_28px_90px_rgba(38,26,42,0.26)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid size-10 place-items-center rounded-md bg-[#fff0f0] text-[#963e43]">
            <AlertTriangle size={19} strokeWidth={1} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="grid size-8 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1} />
          </button>
        </div>
        <p className="mt-5 text-[10px] font-semibold tracking-[0.14em] text-[#963e43]">
          Permanent action
        </p>
        <h2 id={titleId} className="mt-2 font-[var(--serif)] text-[19px] font-light tracking-[-0.045em] text-[var(--ink)]">
          Delete {count} {collectionLabel}?
        </h2>
        <p className="mt-3 max-w-md text-[13px] leading-6 text-[var(--body)]">
          This removes the selected collections, their documents, and their stored source files. This action cannot be undone.
        </p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-10 rounded-md px-3.5 text-[12px] font-medium text-[var(--body)] transition hover:bg-[var(--paper)] disabled:opacity-50"
          >
            Keep {collectionLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#963e43] px-4 text-[12px] font-medium text-white transition duration-200 hover:-translate-y-px hover:bg-[#783034] active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
          >
            {isDeleting ? (
              <><Spinner className="size-3.5 animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 size={14} strokeWidth={1} /> Delete {count} {collectionLabel}</>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
