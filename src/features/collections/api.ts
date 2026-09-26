import { supabase } from "../../lib/supabaseClient";
import { createClientId } from "../../lib/clientId";
import { createContentHash, extractText } from "../documents/extractText";
import type { ExtractedDocument } from "../documents/extractText";
import type { Collection, CollectionDocument } from "./types/domain";

type CollectionRow = { id: string; name: string; created_at: string; last_opened_at?: string | null; open_count?: number | null; documents?: DocumentRow[] };
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
  return { id: row.id, name: row.name, createdAt: row.created_at, lastUsedAt: row.last_opened_at ?? undefined, openCount: row.open_count ?? 0, documents: (row.documents ?? []).map(toDocument) };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  if (!data.user) throw new Error("Your session has ended. Sign in again to continue.");
  return data.user.id;
}

export async function listCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("id, name, created_at, last_opened_at, open_count, documents(id, filename, storage_path, file_size_bytes, status, page_count, chunk_count, embedded_chunk_count, created_at)")
    .order("created_at", { ascending: false })
    .order("created_at", { foreignTable: "documents", ascending: false });
  throwIfError(error);
  return ((data ?? []) as unknown as CollectionRow[]).map(toCollection);
}

export async function createCollection(name: string) {
  const userId = await currentUserId();
  const { data, error } = await supabase.from("collections").insert({ user_id: userId, name: name.trim() }).select("id, name, created_at, last_opened_at, open_count").single();
  throwIfError(error);
  return toCollection(data as CollectionRow);
}

export async function recordCollectionOpen(collectionId: string) {
  const { error } = await supabase.rpc("record_collection_open", { target_collection_id: collectionId });
  throwIfError(error);
}
export async function renameCollection(collectionId: string, name: string) {
  const { error } = await supabase.from("collections").update({ name: name.trim() }).eq("id", collectionId);
  throwIfError(error);
}

export async function removeDocument(document: CollectionDocument) {
  const { error: storageError } = await supabase.storage.from("notes-documents").remove([document.storagePath]);
  throwIfError(storageError);
  const { error } = await supabase.from("documents").delete().eq("id", document.id);
  throwIfError(error);
}

export async function deleteCollection(collection: Collection) {
  if (collection.documents.length) {
    const { error: storageError } = await supabase.storage.from("notes-documents").remove(collection.documents.map((document) => document.storagePath));
    throwIfError(storageError);
  }
  const { error } = await supabase.from("collections").delete().eq("id", collection.id);
  throwIfError(error);
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "document";
}

function resolveContentType(file: File) {
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".md")) return "text/markdown";
  if (filename.endsWith(".txt")) return "text/plain";
  return file.type || "application/octet-stream";
}

function isPdfUpload(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function extractUploadText(file: File): Promise<ExtractedDocument> {
  if (isPdfUpload(file)) {
    const { extractPdfText } = await import("../documents/extractPdfText");
    return extractPdfText(file);
  }

  return extractText(file);
}

export async function uploadDocument(collectionId: string, file: File) {
  const userId = await currentUserId();
  const extracted = await extractUploadText(file);
  const contentHash = await createContentHash(extracted.normalizedText);
  const { data: duplicate, error: duplicateError } = await supabase.from("documents").select("id").eq("collection_id", collectionId).eq("content_hash", contentHash).maybeSingle();
  throwIfError(duplicateError);
  if (duplicate) throw new Error("This document is already in this collection. We skipped it to avoid embedding the same material twice.");

  const storagePath = `${userId}/${collectionId}/${createClientId()}-${safeFilename(file.name)}`;
  const { error: storageError } = await supabase.storage.from("notes-documents").upload(storagePath, file, { cacheControl: "3600", contentType: resolveContentType(file), upsert: false });
  throwIfError(storageError);

  const { data, error } = await supabase.from("documents").insert({
    collection_id: collectionId,
    filename: file.name,
    storage_path: storagePath,
    file_size_bytes: file.size,
    status: "pending",
    page_count: extracted.pageCount,
    content_hash: contentHash,
  }).select("id, filename, storage_path, file_size_bytes, status, page_count, chunk_count, embedded_chunk_count, created_at").single();

  if (error) {
    await supabase.storage.from("notes-documents").remove([storagePath]);
    throwIfError(error);
  }
  const document = toDocument(data as DocumentRow);
  void supabase.functions
    .invoke("ingest-document", { body: { documentId: document.id, pages: extracted.pages } })
    .then(({ error: ingestError }) => {
      if (!ingestError) return;
      return supabase.from("documents").update({ status: "failed" }).eq("id", document.id);
    });

  return document;
}
