import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { navigate } from "../../../app/navigation";
import { Spinner } from "../../../components/ui/spinner";
import type { Collection } from "../types/domain";

type CollectionSettingsPageProps = {
  collection: Collection;
  onRename: (collectionId: string, name: string) => Promise<void>;
  onRemoveDocument: (collectionId: string, documentId: string) => Promise<void>;
  onDelete: (collectionId: string) => Promise<void>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function CollectionSettingsPage({
  collection,
  onRename,
  onRemoveDocument,
  onDelete,
}: CollectionSettingsPageProps) {
  const [name, setName] = useState(collection.name);
  const [renameSaved, setRenameSaved] = useState(false);
  const [documentToRemove, setDocumentToRemove] = useState<string | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isRemovingDocument, setIsRemovingDocument] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const selectedDocument = collection.documents.find(
    (document) => document.id === documentToRemove,
  );
  const onSubmitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    setActionError("");
    setIsRenaming(true);
    try {
      await onRename(collection.id, nextName);
      setRenameSaved(true);
      window.setTimeout(() => setRenameSaved(false), 2200);
    } catch (renameError) {
      setActionError(renameError instanceof Error ? renameError.message : "We could not save this name.");
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-9">
      <div className="pb-8">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--purple)]">
          Collection settings
        </p>
        <p className="mt-5 max-w-xl text-[14px] leading-7 text-[var(--body)]">
          Manage the collection name and its source material. Removing a
          document only affects this collection.
        </p>
      </div>
      <div className="space-y-10">
        <section className="grid gap-7 py-9 md:grid-cols-[170px_1fr]">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--ink)]">
              Collection name
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
              Use a name that makes it easy to find this study context again.
            </p>
          </div>
          <form onSubmit={onSubmitRename} className="max-w-xl">
            <label htmlFor="settings-name" className="sr-only">
              Collection name
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="settings-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setRenameSaved(false);
                }}
                className="h-11 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-[13px] outline-none transition focus:border-[var(--purple)] focus:ring-4 focus:ring-[rgba(95,61,130,0.1)]"
              />
              <button
                type="submit"
                disabled={isRenaming || !name.trim() || name.trim() === collection.name}
                className="h-11 rounded-md bg-[var(--purple)] px-4 text-[12px] font-medium text-white transition duration-200 ease-out hover:-translate-y-px hover:bg-[var(--purple-dark)] active:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#b7a4c5]"
              >
                Save name
              </button>
            </div>
            {renameSaved && (
              <p className="mt-2 text-[11px] text-[#57824f]" role="status">
                Collection name saved.
              </p>
            )}
          </form>
        </section>
        <section className="grid gap-7 py-9 md:grid-cols-[170px_1fr]">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--ink)]">
              Documents
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
              Only add sources that belong to this topic. Better context
              produces more precise retrieval.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() =>
                navigate({ name: "upload", collectionId: collection.id })
              }
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-[12px] shadow-[0_4px_12px_rgba(66,47,39,0.07)] font-medium text-[var(--body)] transition duration-200 ease-out hover:-translate-y-px hover:border-[var(--purple)] hover:text-[var(--purple)] active:translate-y-0"
            >
              <Plus size={15} strokeWidth={1}/> <span className="text-sm">Add documents</span>
            </button>
            {collection.documents.length ? (
              <ul className="mt-4 space-y-2">
                {collection.documents.map((document) => (
                  <li
                    key={document.id}
                    className="group flex items-center gap-3 bg-white px-3.5 py-3 shadow-[0_5px_16px_rgba(66,47,39,0.04)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-[0_10px_20px_rgba(66,47,39,0.07)]"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--paper)] text-[var(--purple)]">
                      <FileText size={15} strokeWidth={1} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[var(--ink)]">
                        {document.filename}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        Added {formatDate(document.addedAt)} ·{" "}
                        {document.status === "ready"
                          ? "Ready"
                          : document.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocumentToRemove(document.id)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] transition duration-200 ease-out hover:scale-105 hover:bg-[#fff2f2] hover:text-[#a0464b]"
                      aria-label={`Remove ${document.filename}`}
                    >
                      <Trash2 size={15} strokeWidth={1}/>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 bg-[var(--paper)] p-6 text-center shadow-[0_10px_24px_rgba(66,47,39,0.04)]">
                <FileText size={20} strokeWidth={1} className="mx-auto text-[var(--purple)]" />
                <h3 className="mt-3 font-[var(--serif)] text-[15px] leading-none tracking-[-0.045em]">
                  No documents in this collection.
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[var(--body)]">
                  Add a text-based PDF or plain-text note before starting a
                  source-grounded chat.
                </p>
              </div>
            )}
          </div>
        </section>
        <section className="grid gap-7 py-9 md:grid-cols-[170px_1fr]">
          <div>
            <h2 className="text-[13px] font-semibold text-[#963e43]">
              Danger zone
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
              Deleting removes this collection and its local screen data.
            </p>
          </div>
          <div className="bg-[#fff9f9] p-4 shadow-[0_10px_24px_rgba(143,61,66,0.07)] sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div>
              <p className="text-[12px] font-semibold text-[#81393d]">
                Delete “{collection.name}”
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[#8f6467]">
                This action cannot be undone
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteConfirmationOpen(true)}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-white shadow-[0_4px_12px_rgba(143,61,66,0.09)] px-3 text-[12px] font-medium text-[#963e43] transition hover:bg-[#fff2f2] sm:mt-0"
            >
              <Trash2 size={14} strokeWidth={1}/> Delete
            </button>
          </div>
        </section>
      </div>
      {actionError && (
        <p className="mb-5 bg-[#fff7f7] px-3 py-2 text-[12px] text-[#8f3d42]" role="alert">{actionError}</p>
      )}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            onClick={() => setDocumentToRemove(null)}
            className="absolute inset-0 h-full w-full bg-[rgba(30,26,32,0.5)]"
            aria-label="Cancel document removal"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-document-title"
            className="relative w-full max-w-sm bg-[var(--cream)] p-6 shadow-[0_24px_70px_rgba(30,26,32,0.24)]"
          >
            <h2
              id="remove-document-title"
              className="font-[var(--serif)] text-[20px] leading-none tracking-[-0.055em]"
            >
              Remove this source?
            </h2>
            <p className="mt-4 text-[13px] leading-6 text-[var(--body)]">
              “{selectedDocument.filename}” will no longer be available to this
              collection.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocumentToRemove(null)}
                className="h-9 rounded-md px-3 text-[12px] text-[var(--body)] hover:bg-[var(--paper)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActionError("");
                  setIsRemovingDocument(true);
                  try {
                    await onRemoveDocument(collection.id, selectedDocument.id);
                    setDocumentToRemove(null);
                  } catch (removeError) {
                    setActionError(removeError instanceof Error ? removeError.message : "We could not remove this document.");
                  } finally {
                    setIsRemovingDocument(false);
                  }
                }}
                disabled={isRemovingDocument}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#963e43] px-3 text-[12px] font-medium text-white hover:bg-[#783034] disabled:cursor-wait disabled:opacity-70"
              >
                {isRemovingDocument ? <><Spinner className="size-3.5 animate-spin" /> Removing…</> : "Remove document"}
              </button>
            </div>
          </section>
        </div>
      )}
      {isDeleteConfirmationOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            onClick={() => setIsDeleteConfirmationOpen(false)}
            className="absolute inset-0 h-full w-full bg-[rgba(30,26,32,0.5)]"
            aria-label="Cancel collection deletion"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-collection-title"
            className="relative w-full max-w-sm bg-[var(--cream)] p-6 shadow-[0_24px_70px_rgba(30,26,32,0.24)]"
          >
            <AlertTriangle size={22} className="text-[#963e43]" strokeWidth={1}/>
            <h2
              id="delete-collection-title"
              className="mt-4 font-[var(--serif)] text-[20px] leading-none tracking-[-0.055em]"
            >
              Delete this collection?
            </h2>
            <p className="mt-4 text-[13px] leading-6 text-[var(--body)]">
              All documents and conversations associated with “{collection.name}
              ” will be removed.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmationOpen(false)}
                className="h-9 rounded-md px-3 text-[12px] text-[var(--body)] hover:bg-[var(--paper)]"
              >
                Keep collection
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActionError("");
                  setIsDeleting(true);
                  try {
                    await onDelete(collection.id);
                  } catch (deleteError) {
                    setActionError(deleteError instanceof Error ? deleteError.message : "We could not delete this collection.");
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#963e43] px-3 text-[11px] font-medium text-white hover:bg-[#783034] disabled:cursor-wait disabled:opacity-70"
              >
                {isDeleting ? <><Spinner className="size-3.5 animate-spin" /> Deleting…</> : <>Delete <ArrowRight size={14} strokeWidth={1} /></>}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
