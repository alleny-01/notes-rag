import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Book,
  ChevronRight,
  Clock3,
  FileText,
  FolderPlus,
  Layers3,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  ScanSearch,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Collection } from "../types/domain";
import { navigate } from "../../../app/navigation";

type LibraryPageProps = {
  collections: Collection[];
  onOpenCollection: (collectionId: string) => void;
  onOpenCreateCollection: () => void;
};

type CollectionOrder =
  | "default"
  | "newest"
  | "oldest"
  | "most-documents"
  | "fewest-documents"
  | "frequently-opened";

const collectionOrderOptions: Array<{ value: CollectionOrder; label: string }> =
  [
    { value: "default", label: "Default order" },
    { value: "newest", label: "Newest to oldest" },
    { value: "oldest", label: "Oldest to newest" },
    { value: "most-documents", label: "Most documents" },
    { value: "fewest-documents", label: "Fewest documents" },
    { value: "frequently-opened", label: "Frequently opened" },
  ];

function timeLabel(date?: string) {
  if (!date) return "Not opened yet";
  const difference = Date.now() - new Date(date).getTime();
  if (difference < 86_400_000) return "Opened today";
  if (difference < 172_800_000) return "Opened yesterday";
  return `Opened ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(date))}`;
}

function dateValue(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function compareCollections(order: CollectionOrder) {
  return (left: Collection, right: Collection) => {
    if (order === "newest")
      return dateValue(right.createdAt) - dateValue(left.createdAt);
    if (order === "oldest")
      return dateValue(left.createdAt) - dateValue(right.createdAt);
    if (order === "most-documents")
      return (
        right.documents.length - left.documents.length ||
        dateValue(right.createdAt) - dateValue(left.createdAt)
      );
    if (order === "fewest-documents")
      return (
        left.documents.length - right.documents.length ||
        dateValue(right.createdAt) - dateValue(left.createdAt)
      );
    if (order === "frequently-opened")
      return (
        right.openCount - left.openCount ||
        dateValue(right.lastUsedAt) - dateValue(left.lastUsedAt) ||
        dateValue(right.createdAt) - dateValue(left.createdAt)
      );
    return 0;
  };
}

function LibraryHeader({ count }: { count: number }) {
  return (
    <section className="flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--purple)]">
          Your Library
        </p>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
        <span>
          {count
            ? `${count} ${count === 1 ? "collection" : "collections"}`
            : "Your library is empty"}
        </span>
        <span className="h-1 w-1 rounded-full bg-[var(--purple)]" />
        <span>Private to you</span>
      </div>
    </section>
  );
}

function FirstCollectionCanvas({ onOpenCreateCollection }: { onOpenCreateCollection: () => void }) {
  return (
    <section className="mt-9 grid gap-2 overflow-hidden bg-[var(--canvas)] lg:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
      <div className="relative overflow-hidden p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[rgba(95,61,130,0.05)]" />
        <div className="pointer-events-none absolute -right-5 -top-9 h-32 w-32 rounded-full bg-[rgba(95,61,130,0.08)]" />
        <div className="relative max-w-md">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--lilac)] text-[var(--purple)] transition duration-300 ease-out hover:rotate-6 hover:scale-110">
            <FolderPlus size={19} strokeWidth={1} />
          </div>
          <p className="mt-7 text-[10px] font-semibold tracking-[0.14em] text-[var(--purple)]">
            Begin with one context
          </p>
          <h2 className="mt-3 font-[var(--serif)] text-[15px] font-light leading-[1.15] tracking-[-0.04em]">
            Create a shelf for the notes that belong together.
          </h2>
          <p className="mt-4 max-w-[34rem] text-[13px] leading-6 text-[var(--body)]">
            A collection can be a course, a paper, or a project. Keep related
            material together and the questions you ask later will have a
            clearer source of truth.
          </p>
          <button
            type="button"
            onClick={onOpenCreateCollection}
            className="mt-7 inline-flex h-10 items-center gap-2 rounded-md bg-[var(--purple)] px-3.5 text-[12px] font-medium text-white transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--purple-dark)] active:translate-y-0"
          >
            Create a collection <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <aside className="bg-[var(--paper)] p-6 sm:p-9">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--muted)]">
          A calmer study loop
        </p>
        <ol className="mt-7 space-y-6">
          {[
            [
              "01",
              "Add the material",
              "Text PDFs and plain notes, all under one subject.",
            ],
            [
              "02",
              "Ask with context",
              "Keep each conversation in the place its sources belong.",
            ],
            [
              "03",
              "Trace each answer",
              "Follow a useful response back to the passage that supports it.",
            ],
          ].map(([number, title, copy]) => (
            <li key={number} className="grid grid-cols-[25px_1fr] gap-3">
              <span className="font-mono text-[10px] text-[var(--purple)]">
                {number}
              </span>
              <div>
                <h3 className="text-[13px] font-medium text-[var(--ink)]">
                  {title}
                </h3>
                <p className="mt-1 text-[11px] leading-5 text-[var(--body)]">
                  {copy}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

function CollectionSearch({
  query,
  onChange,
  matches,
  order,
  onOrderChange,
}: {
  query: string;
  onChange: (value: string) => void;
  matches: number;
  order: CollectionOrder;
  onOrderChange: (value: CollectionOrder) => void;
}) {
  return (
    <div className="mt-7 flex flex-col gap-3 bg-[var(--paper)] p-3 shadow-[0_10px_22px_rgba(66,47,39,0.04)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 bg-white px-3 shadow-[inset_0_0_0_1px_rgba(222,214,203,0.58)] transition focus-within:shadow-[inset_0_0_0_1px_var(--purple),0_0_0_3px_rgba(95,61,130,0.1)]">
        <Search size={15} className="shrink-0 text-[var(--purple)]" strokeWidth={1} />
        <label htmlFor="collection-search" className="sr-only">
          Search collections
        </label>
        <input
          id="collection-search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search collections or documents"
          className="h-10 min-w-0 flex-1 bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid h-7 w-7 place-items-center text-[var(--muted)] transition hover:scale-105 hover:text-[var(--purple)]"
            aria-label="Clear collection search"
          >
            <X size={15} strokeWidth={1} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <label className="flex h-10 min-w-0 items-center gap-2 bg-white px-3 text-[var(--muted)] shadow-[inset_0_0_0_1px_rgba(222,214,203,0.58)]">
          <SlidersHorizontal
            size={14}
            className="shrink-0 text-[var(--purple)]" strokeWidth={1} />
          <span className="sr-only">Collection order</span>
          <select
            aria-label="Collection order"
            value={order}
            onChange={(event) =>
              onOrderChange(event.target.value as CollectionOrder)
            }
            className="min-w-0 bg-transparent text-[11px] text-[var(--ink)] outline-none"
          >
            {collectionOrderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="shrink-0 text-[11px] text-[var(--muted)]">
          {query
            ? `${matches} ${matches === 1 ? "match" : "matches"}`
            : `${matches} shown`}
        </p>
      </div>
    </div>
  );
}

function CollectionRow({
  collection,
  index,
  onOpenCollection,
}: {
  collection: Collection;
  index: number;
  onOpenCollection: (collectionId: string) => void;
}) {
  const hasDocuments = collection.documents.length > 0;
  const destination = hasDocuments
    ? { name: "workspace" as const, collectionId: collection.id }
    : { name: "upload" as const, collectionId: collection.id };
  const open = () => {
    if (hasDocuments) onOpenCollection(collection.id);
    navigate(destination);
  };
  return (
    <article className="group grid gap-4 bg-[var(--cream)] px-4 py-5 shadow-[0_1px_0_rgba(66,47,39,0.03)] transition-all duration-300 hover:-translate-y-px hover:bg-white hover:shadow-[0_14px_26px_rgba(66,47,39,0.08)] sm:grid-cols-[38px_minmax(0,1fr)_auto] sm:items-center">
      <span className="hidden font-mono text-[10px] text-[var(--muted)] sm:block">
        {String(index + 1).padStart(2, "0")}
      </span>
      <button type="button" onClick={open} className="min-w-0 text-left">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--lilac)] text-[var(--purple)] transition duration-300 ease-out group-hover:rotate-3 group-hover:scale-110">
            <Book size={16} strokeWidth={1} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-[var(--serif)] text-[15px] font-light tracking-[-0.04em] text-[var(--ink)] transition duration-200 group-hover:text-[var(--purple)]">
              {collection.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <FileText size={12} strokeWidth={1} /> {collection.documents.length}{" "}
                {collection.documents.length === 1 ? "document" : "documents"}
              </span>
              <span className="hidden text-[var(--line)] sm:inline">/</span>
              <span className="inline-flex items-center gap-1">
                <Clock3 size={12} strokeWidth={1} /> {timeLabel(collection.lastUsedAt)}
                {collection.openCount > 0 ? ` · ${collection.openCount}×` : ""}
              </span>
            </p>
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <button
          type="button"
          onClick={() =>
            navigate({ name: "settings", collectionId: collection.id })
          }
          className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] opacity-100 transition duration-200 hover:scale-105 hover:bg-white hover:text-[var(--ink)] sm:scale-90 sm:opacity-0 sm:group-hover:scale-100 sm:group-hover:opacity-100"
          aria-label={`Open ${collection.name} settings`}
        >
          <MoreHorizontal size={16} strokeWidth={1} />
        </button>
        <button
          type="button"
          onClick={open}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium text-[var(--purple)] transition duration-200 hover:bg-white hover:pl-3.5"
        >
          <span className="text-sm">{hasDocuments ? "Open" : "Add notes"}</span>
          <ChevronRight size={14} strokeWidth={1} />
        </button>
      </div>
    </article>
  );
}

function CollectionShelf({
  collections,
  onClear,
  onOpenCollection,
  onOpenCreateCollection,
}: {
  collections: Collection[];
  onClear: () => void;
  onOpenCollection: (collectionId: string) => void;
  onOpenCreateCollection: () => void;
}) {
  return (
    <section className="mt-9 w-full">
      <div>
        <div className="flex items-center justify-between pb-3">
          <p className="text-[12px] font-medium text-[var(--ink)]">
            Your collection index
          </p>
          <button
            type="button"
            onClick={onOpenCreateCollection}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--purple)] transition duration-200 hover:translate-x-0.5 hover:text-[var(--purple-dark)]"
          >
            <Plus size={16} strokeWidth={1} />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {collections.length ? (
            collections.map((collection, index) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                index={index}
                onOpenCollection={onOpenCollection}
              />
            ))
          ) : (
            <div className="bg-[var(--paper)] px-5 py-12 text-center shadow-[0_12px_26px_rgba(66,47,39,0.04)]">
              <Search size={20} className="mx-auto text-[var(--purple)]" strokeWidth={1} />
              <h2 className="mt-4 font-[var(--serif)] text-[20px] font-light tracking-[-0.04em]">
                No matching collection.
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-[var(--body)]">
                Try another search or filter, or clear the controls to see your
                full library.
              </p>
              <button
                type="button"
                onClick={onClear}
                className="mt-5 text-[11px] font-medium text-[var(--purple)] transition hover:translate-x-0.5 hover:text-[var(--purple-dark)]"
              >
                Clear filters <ArrowUpRight size={13} className="inline" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LibrarySignal({ collections }: { collections: Collection[] }) {
  const totalDocuments = collections.reduce(
    (total, collection) => total + collection.documents.length,
    0,
  );
  return (
    <section className="mt-5 relative overflow-hidden bg-[var(--paper)] p-5 shadow-[0_16px_34px_rgba(66,47,39,0.06)] xl:mt-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[rgba(95,61,130,0.12)] blur-2xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--purple)]">
          Library signal
        </p>
        <div className="mt-8 space-y-6">
          <div>
            <p className="font-mono text-[20px] font-light tracking-[-0.04em] text-[var(--ink)]">
              {collections.length}
            </p>
            <p className="mt-1 text-[11px] text-[var(--body)]">
              matching study contexts
            </p>
          </div>
          <div className="h-px bg-[var(--line)]" />
          <div>
            <p className="font-mono text-[20px] font-light tracking-[-0.04em] text-[var(--ink)]">
              {totalDocuments}
            </p>
            <p className="mt-1 text-[11px] text-[var(--body)]">
              documents in these results
            </p>
          </div>
        </div>
        <div className="mt-9 pt-5">
          <div className="flex items-start gap-2.5">
            <ScanSearch
              size={16}
              className="mt-0.5 shrink-0 text-[var(--purple)]" strokeWidth={1} />
            <p className="text-[11px] leading-5 text-[var(--body)]">
              Search matches both collection titles and document filenames.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LibraryPage({
  collections,
  onOpenCollection,
  onOpenCreateCollection,
}: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<CollectionOrder>("default");
  const matchingCollections = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const filtered = term
      ? collections.filter(
          (collection) =>
            collection.name.toLocaleLowerCase().includes(term) ||
            collection.documents.some((document) =>
              document.filename.toLocaleLowerCase().includes(term),
            ),
        )
      : collections;
    return [...filtered].sort(compareCollections(order));
  }, [collections, order, query]);
  const clearFilters = () => {
    setQuery("");
    setOrder("default");
  };
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-9 sm:px-6 sm:py-12 lg:px-9">
      <LibraryHeader count={collections.length} />
      {collections.length ? (
        <>
          <CollectionSearch
            query={query}
            onChange={setQuery}
            matches={matchingCollections.length}
            order={order}
            onOrderChange={setOrder}
          />
          <CollectionShelf
            collections={matchingCollections}
            onClear={clearFilters}
            onOpenCollection={onOpenCollection}
            onOpenCreateCollection={onOpenCreateCollection}
          />

          <LibrarySignal collections={matchingCollections} />
        </>
      ) : (
        <FirstCollectionCanvas onOpenCreateCollection={onOpenCreateCollection} />
      )}
      <section className="mt-10 flex flex-col gap-3 pt-5 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2">
          <Layers3 size={14} className="text-[var(--purple)]" strokeWidth={1} />{" "}
          Every collection keeps its sources and conversations in one place.
        </span>
        <span className="inline-flex items-center gap-2">
          <MessageSquareText size={14} strokeWidth={1} /> Answers will always point back to a
          passage.
        </span>
      </section>
    </main>
  );
}
