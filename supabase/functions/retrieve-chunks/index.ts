/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { embedQuery } from "../_shared/voyage.ts";

const SIMILARITY_THRESHOLD = 0.40;
const RETRIEVAL_LIMIT = 5;

type RetrieveRequest = {
  collectionId?: unknown;
  documentId?: unknown;
  question?: unknown;
};

type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  filename: string;
  content: string;
  page_number: number | null;
  chunk_index: number;
  similarity: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    return jsonResponse({ error: "Function configuration is incomplete." }, 500);
  }

  let payload: RetrieveRequest;
  try {
    payload = (await request.json()) as RetrieveRequest;
  } catch {
    return jsonResponse({ error: "A JSON request body is required." }, 400);
  }

  const collectionId = typeof payload.collectionId === "string" ? payload.collectionId : "";
  const documentId = typeof payload.documentId === "string" ? payload.documentId : null;
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!isUuid(collectionId) || (documentId !== null && !isUuid(documentId))) {
    return jsonResponse({ error: "A valid collection id is required." }, 400);
  }
  if (question.length < 3 || question.length > 1_200) {
    return jsonResponse({ error: "Questions must be between 3 and 1,200 characters." }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: "Unauthorized." }, 401);

  const { data: collection, error: collectionError } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .maybeSingle();
  if (collectionError || !collection) return jsonResponse({ error: "Collection not found." }, 404);

  try {
    const queryEmbedding = await embedQuery(question);
    const { data, error } = await supabase.rpc("match_collection_chunks", {
      target_collection_id: collectionId,
      query_embedding: queryEmbedding,
      similarity_threshold: SIMILARITY_THRESHOLD,
      result_limit: RETRIEVAL_LIMIT,
      target_document_id: documentId,
    });
    if (error) throw error;

    const chunks = (data ?? []) as RetrievedChunk[];
    return jsonResponse({
      notFound: chunks.length === 0,
      threshold: SIMILARITY_THRESHOLD,
      bestSimilarity: chunks[0]?.similarity ?? null,
      chunks,
    });
  } catch (error) {
    console.error("retrieve-chunks failed", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: "We could not search this collection. Please try again." }, 500);
  }
});
