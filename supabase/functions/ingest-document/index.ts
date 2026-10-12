/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { chunkPages, type SourcePage } from "../_shared/chunking.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { embedDocuments } from "../_shared/voyage.ts";

const EMBEDDING_BATCH_SIZE = 48;

type IngestRequest = { documentId?: unknown; pages?: unknown };
type DocumentRecord = { id: string; collection_id: string; status: string };
type CollectionRecord = { user_id: string };

function parsePages(value: unknown): SourcePage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10_000)
    return null;
  const pages = value.map((page) => {
    if (!page || typeof page !== "object") return null;
    const candidate = page as { pageNumber?: unknown; text?: unknown };
    if (
      !Number.isInteger(candidate.pageNumber) ||
      (candidate.pageNumber as number) < 1 ||
      typeof candidate.text !== "string"
    )
      return null;
    const text = candidate.text.trim();
    if (!text || text.length > 250_000) return null;
    return { pageNumber: candidate.pageNumber as number, text };
  });
  return pages.every(Boolean) ? (pages as SourcePage[]) : null;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Document ingestion failed.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !authorization) {
    return jsonResponse(
      { error: "Function configuration is incomplete." },
      500,
    );
  }

  const authenticated = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } =
    await authenticated.auth.getUser();
  if (authError || !authData.user)
    return jsonResponse({ error: "Unauthorized." }, 401);

  let payload: IngestRequest;
  try {
    payload = (await request.json()) as IngestRequest;
  } catch {
    return jsonResponse({ error: "A JSON request body is required." }, 400);
  }

  const documentId =
    typeof payload.documentId === "string" ? payload.documentId : "";
  const pages = parsePages(payload.pages);
  if (!documentId || !pages) {
    return jsonResponse(
      { error: "Provide a document id and non-empty extracted pages." },
      400,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: document, error: documentError } = await admin
    .from("documents")
    .select("id, collection_id, status")
    .eq("id", documentId)
    .maybeSingle<DocumentRecord>();
  if (documentError || !document)
    return jsonResponse({ error: "Document not found." }, 404);

  const { data: collection, error: collectionError } = await admin
    .from("collections")
    .select("user_id")
    .eq("id", document.collection_id)
    .maybeSingle<CollectionRecord>();
  if (
    collectionError ||
    !collection ||
    collection.user_id !== authData.user.id
  ) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }
  if (document.status === "ready")
    return jsonResponse({ status: "ready", skipped: true });

  try {
    const chunks = chunkPages(pages);
    if (!chunks.length)
      throw new Error("No usable text chunks were found in this document.");

    const { error: prepareError } = await admin
      .from("documents")
      .update({
        status: "embedding",
        chunk_count: chunks.length,
        embedded_chunk_count: 0,
      })
      .eq("id", documentId);
    if (prepareError) throw prepareError;

    const { error: deleteError } = await admin
      .from("chunks")
      .delete()
      .eq("document_id", documentId);
    if (deleteError) throw deleteError;

    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      const embeddings = await embedDocuments(
        batch.map((chunk) => chunk.content),
      );
      const { error: chunkError } = await admin.from("chunks").insert(
        batch.map((chunk, index) => ({
          document_id: documentId,
          content: chunk.content,
          page_number: chunk.pageNumber,
          chunk_index: chunk.chunkIndex,
          embedding: embeddings[index],
        })),
      );
      if (chunkError) throw chunkError;

      const { error: progressError } = await admin
        .from("documents")
        .update({
          embedded_chunk_count: Math.min(start + batch.length, chunks.length),
        })
        .eq("id", documentId);
      if (progressError) throw progressError;
    }

    const { error: completeError } = await admin
      .from("documents")
      .update({ status: "ready", embedded_chunk_count: chunks.length })
      .eq("id", documentId);
    if (completeError) throw completeError;
    return jsonResponse({ status: "ready", chunkCount: chunks.length });
  } catch (error) {
    await admin
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId);
    console.error("ingest-document failed", safeErrorMessage(error));
    return jsonResponse(
      { error: "We could not index this document. Please try again." },
      500,
    );
  }
});
