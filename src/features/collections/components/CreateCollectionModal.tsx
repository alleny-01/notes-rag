import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, FolderPlus, X } from "lucide-react";
import { Spinner } from "../../../components/ui/spinner";

type CreateCollectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
};

export function CreateCollectionModal({
  isOpen,
  onClose,
  onCreate,
}: CreateCollectionModalProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isCreatingRef = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setError("");
    isCreatingRef.current = false;
    setIsCreating(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCreatingRef.current) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (value.length < 2) {
      setError("Give this collection a name with at least 2 characters.");
      return;
    }

    setError("");
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      await onCreate(value);
      onClose();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "We could not create this collection.",
      );
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close new collection dialog"
        onClick={onClose}
        disabled={isCreating}
        className="absolute inset-0 bg-[rgba(27,25,26,0.34)] backdrop-blur-[2px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
        className="relative w-full max-w-[31rem] overflow-hidden bg-[var(--cream)] p-5 shadow-[0_28px_90px_rgba(38,26,42,0.26)] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--purple)]">
              <FolderPlus size={13} strokeWidth={1} /> New collection
            </p>
            <h2
              id="create-collection-title"
              className="mt-3 font-[var(--serif)] text-[15px] font-light tracking-[-0.045em] text-[var(--ink)]"
            >
              Start a study context.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="grid size-8 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1} />
          </button>
        </div>
        <p className="mt-3 max-w-md text-[13px] leading-6 text-[var(--body)]">
          Keep one course, paper, or topic together so every answer has a clear
          source of truth.
        </p>
        <form className="mt-6" onSubmit={onSubmit}>
          <label
            htmlFor={inputId}
            className="text-[12px] font-semibold text-[var(--ink)]"
          >
            What are you studying?
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            placeholder="e.g. Data structures, Biology 101"
            disabled={isCreating}
            className="mt-3 h-12 w-full rounded-md border border-[var(--line)] bg-white px-3.5 text-[14px] outline-none transition placeholder:text-[#aaa19a] focus:border-[var(--purple)] focus:ring-4 focus:ring-[rgba(95,61,130,0.12)] disabled:cursor-wait disabled:opacity-70"
          />
          {error && (
            <p className="mt-2 text-[12px] text-[var(--signal)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isCreating}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--purple)] px-4 text-[13px] font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--purple-dark)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
          >
            {isCreating ? (
              <>
                <Spinner className="size-4 animate-spin" />{" "}
                <span className="text-sm">Creating collection…</span>
              </>
            ) : (
              <>
                <span className="text-sm">Create collection </span>
                <ArrowRight size={16} strokeWidth={1} />
              </>
            )}
          </button>
        </form>
        <div className="mt-6 flex items-start gap-3 bg-[var(--paper)] p-3.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--lilac)] text-[var(--purple)]">
            <BookOpen size={16} strokeWidth={1} />
          </div>
          <p className="text-[11px] leading-5 text-[var(--body)]">
            <strong className="font-semibold text-[var(--ink)]">
              A simple rule:
            </strong>{" "}
            keep documents that belong to the same study context together.
          </p>
        </div>
      </section>
    </div>
  );
}
