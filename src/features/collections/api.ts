import { supabase } from "../../lib/supabaseClient";
import { createClientId } from "../../lib/clientId";
import {
  createContentHash,
  createFileHash,
  extractText,
} from "../documents/extractText";
import type {
  ExtractedDocument,
  ExtractedPage,
} from "../documents/extractText";
import { resolveContentType, toUploadFile } from "../documents/uploadFile";
import type { Collection, CollectionDocument } from "./types/domain";

export { resolveContentType, toUploadFile } from "../documents/uploadFile";

export type UploadProgress = (label: string) => void;
type CollectionRow = {
  id: string;
  name: string;
  created_at: string;
  last_opened_at?: string | null;
  open_count?: number | null;
  documents?: DocumentRow[];
};
type DocumentRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number;
  status: CollectionDocument["status"];
  page_count: number | null;
  chunk_count: number | null;
  embedded_chunk_count: number | null;
  created_at: string;
};
type PdfPageResponse = {
  pageCount: number;
  pages?: ExtractedPage[];
  error?: string;
  code?: string;
};

function toDocument(row: DocumentRow): CollectionDocument {
  return {
    id: row.id,
    filename: row.filename,
    storagePath: row.storage_path,
    size: row.file_size_bytes,
    status: row.status,
    pageCount: row.page_count ?? undefined,
    chunkCount: row.chunk_count ?? undefined,
    embeddedChunkCount: row.embedded_chunk_count ?? undefined,
    addedAt: row.created_at,
  };
}

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_opened_at ?? undefined,
    openCount: row.open_count ?? 0,
    documents: (row.documents ?? []).map(toDocument),
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  if (!data.user)
    throw new Error("Your session has ended. Sign in again to continue.");
  return data.user.id;
}

export async function listCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select(
      "id, name, created_at, last_opened_at, open_count, documents(id, filename, storage_path, file_size_bytes, status, page_count, chunk_count, embedded_chunk_count, created_at)",
    )
    .order("created_at", { ascending: false })
    .order("created_at", { foreignTable: "documents", ascending: false });
  throwIfError(error);
  return ((data ?? []) as unknown as CollectionRow[]).map(toCollection);
}

export async function createCollection(name: string) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: userId, name: name.trim() })
    .select("id, name, created_at, last_opened_at, open_count")
    .single();
  throwIfError(error);
  return toCollection(data as CollectionRow);
}

export async function recordCollectionOpen(collectionId: string) {
  const { error } = await supabase.rpc("record_collection_open", {
    target_collection_id: collectionId,
  });
  throwIfError(error);
}

export async function renameCollection(collectionId: string, name: string) {
  const { error } = await supabase
    .from("collections")
    .update({ name: name.trim() })
    .eq("id", collectionId);
  throwIfError(error);
}

function safeFilename(filename: string) {
  return (
    filename
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120) || "document"
  );
}

function isPdfUpload(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

async function removePageImages(userId: string, documentId: string) {
  const prefix = `${userId}/${documentId}`;
  const { data, error } = await supabase.storage
    .from("notes-pages")
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const { error: removeError } = await supabase.storage
    .from("notes-pages")
    .remove(data.map((item) => `${prefix}/${item.name}`));
  throwIfError(removeError);
}

async function cleanUpPdfUpload(userId: string, document?: CollectionDocument) {
  if (!document) return;
  await Promise.allSettled([
    removePageImages(userId, document.id),
    supabase.storage.from("notes-documents").remove([document.storagePath]),
  ]);
  await supabase.from("documents").delete().eq("id", document.id);
}

async function callPdfProcessor(
  accessToken: string,
  payload: {
    documentId: string;
    fromPage: number;
    toPage: number;
    renderOnly?: boolean;
  },
) {
  const request = async () => {
    const response = await fetch("/api/process-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as PdfPageResponse;
    if (!response.ok)
      throw new Error(body.error ?? "We could not prepare this PDF.");
    return body;
  };
  try {
    return await request();
  } catch {
    return request();
  }
}

async function preparePdf(
  documentId: string,
  accessToken: string,
  onProgress?: UploadProgress,
) {
  const pages: ExtractedPage[] = [];
  let pageCount = 0;
  for (let fromPage = 1; !pageCount || fromPage <= pageCount; fromPage += 12) {
    const toPage = pageCount ? Math.min(fromPage + 11, pageCount) : 12;
    onProgress?.(
      `Preparing pages ${fromPage}–${toPage}${pageCount ? ` of ${pageCount}` : ""}…`,
    );
    const result = await callPdfProcessor(accessToken, {
      documentId,
      fromPage,
      toPage,
    });
    pageCount = result.pageCount;
    pages.push(...(result.pages ?? []).filter((page) => page.text.trim()));
  }
  return {
    pageCount,
    pages,
    normalizedText: pages.map((page) => page.text).join("\n\n"),
  };
}

export async function backfillPdfPages(
  documentId: string,
  onProgress?: UploadProgress,
) {
  const accessToken = await getAccessToken();
  let pageCount = 0;
  for (let fromPage = 1; !pageCount || fromPage <= pageCount; fromPage += 12) {
    const toPage = pageCount ? Math.min(fromPage + 11, pageCount) : 12;
    onProgress?.(
      `Preparing pages ${fromPage}–${toPage}${pageCount ? ` of ${pageCount}` : ""}…`,
    );
    const result = await callPdfProcessor(accessToken, {
      documentId,
      fromPage,
      toPage,
      renderOnly: true,
    });
    pageCount = result.pageCount;
  }
  return pageCount;
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  throwIfError(error);
  if (!data.session?.access_token)
    throw new Error("Your session has ended. Sign in again to continue.");
  return data.session.access_token;
}

export async function uploadDocument(
  collectionId: string,
  file: File,
  onProgress?: UploadProgress,
) {
  const userId = await currentUserId();
  const isPdf = isPdfUpload(file);
  onProgress?.(isPdf ? "Uploading PDF…" : "Reading document…");
  const extracted = isPdf ? undefined : await extractText(file);
  const contentHash = isPdf
    ? await createFileHash(file)
    : await createContentHash(extracted!.normalizedText);
  const { data: duplicate, error: duplicateError } = await supabase
    .from("documents")
    .select("id")
    .eq("collection_id", collectionId)
    .eq("content_hash", contentHash)
    .maybeSingle();
  throwIfError(duplicateError);
  if (duplicate)
    throw new Error(
      "This document is already in this collection. We skipped it to avoid embedding the same material twice.",
    );

  const storagePath = `${userId}/${collectionId}/${createClientId()}-${safeFilename(file.name)}`;
  const { error: storageError } = await supabase.storage
    .from("notes-documents")
    .upload(storagePath, toUploadFile(file), {
      cacheControl: "3600",
      contentType: resolveContentType(file),
      upsert: false,
    });
  throwIfError(storageError);
  const { data, error } = await supabase
    .from("documents")
    .insert({
      collection_id: collectionId,
      filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      status: "pending",
      page_count: isPdf ? null : extracted!.pageCount,
      content_hash: contentHash,
    })
    .select(
      "id, filename, storage_path, file_size_bytes, status, page_count, chunk_count, embedded_chunk_count, created_at",
    )
    .single();
  if (error) {
    await supabase.storage.from("notes-documents").remove([storagePath]);
    throwIfError(error);
  }

  const document = toDocument(data as DocumentRow);
  try {
    const prepared: ExtractedDocument = isPdf
      ? await preparePdf(document.id, await getAccessToken(), onProgress)
      : extracted!;
    if (!prepared.pages.length)
      throw new Error(
        "This PDF has no selectable text. NotesRAG currently supports text-based PDFs only.",
      );
    onProgress?.("Indexing document…");
    const { error: ingestError } = await supabase.functions.invoke(
      "ingest-document",
      { body: { documentId: document.id, pages: prepared.pages } },
    );
    if (ingestError) throw new Error(ingestError.message);
    return { ...document, pageCount: prepared.pageCount };
  } catch (error) {
    await cleanUpPdfUpload(userId, document);
    throw error;
  }
}

async function sampleNotesFile() {
  const response = await fetch("/samples/sample-notes.md");
  if (!response.ok) throw new Error("We could not load the sample notes.");
  return new File([await response.text()], "sample-notes.md", {
    type: "text/markdown",
  });
}

export async function uploadSampleNotes(
  collectionId: string,
  onProgress?: UploadProgress,
) {
  return uploadDocument(collectionId, await sampleNotesFile(), onProgress);
}

export async function findSampleCollectionId() {
  const file = await sampleNotesFile();
  const extracted = await extractText(file);
  const hash = await createContentHash(extracted.normalizedText);
  const { data, error } = await supabase
    .from("documents")
    .select("collection_id")
    .eq("content_hash", hash)
    .limit(1)
    .maybeSingle<{ collection_id: string }>();
  throwIfError(error);
  return data?.collection_id;
}

export async function removeDocument(document: CollectionDocument) {
  const userId = await currentUserId();
  await removePageImages(userId, document.id);
  const { error: storageError } = await supabase.storage
    .from("notes-documents")
    .remove([document.storagePath]);
  throwIfError(storageError);
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id);
  throwIfError(error);
}

export async function deleteCollection(collection: Collection) {
  const userId = await currentUserId();
  for (const document of collection.documents)
    await removePageImages(userId, document.id);
  if (collection.documents.length) {
    const { error: storageError } = await supabase.storage
      .from("notes-documents")
      .remove(collection.documents.map((document) => document.storagePath));
    throwIfError(storageError);
  }
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collection.id);
  throwIfError(error);
}
