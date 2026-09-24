/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { generateGroundedAnswer } from "../_shared/deepseek.ts";
import { embedQuery } from "../_shared/voyage.ts";

// Tuned against short study-note questions. Keep this aligned with retrieve-chunks
// when manually validating retrieval quality; raise it only if irrelevant passages appear.
const SIMILARITY_THRESHOLD = 0.40;
const RETRIEVAL_LIMIT = 5;
const NOT_FOUND_MESSAGE = "Nothing in your notes covers that yet.";

type ChatRequest = {
  collectionId?: unknown;
  sessionId?: unknown;
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

type Citation = {
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number | null;
  content: string;
  orderIndex: number;
};

type SessionRecord = { id: string; collection_id: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function nextUtcMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function configuredDailyLimit() {
  const value = Number(Deno.env.get("DAILY_MESSAGE_LIMIT") ?? "50");
  return Number.isInteger(value) && value > 0 ? value : null;
}

function buildPrompt(chunks: RetrievedChunk[]) {
  const passages = chunks
    .map((chunk, index) => `[${index + 1}] (${chunk.filename}${chunk.page_number ? `, p.${chunk.page_number}` : ""})\n${chunk.content}`)
    .join("\n\n");

  return `Answer only using the supplied passages. Do not use outside knowledge or make unsupported inferences. For every cited factual claim, preserve the source wording as closely as possible: the sentence or clause immediately before [1], [2], etc. must be a direct or near-direct transcription of the cited passage, not a loose paraphrase. Cite every factual claim inline using only the supplied passage numbers. If the passages do not contain the answer, say so directly.\n\nPassages:\n${passages}`;
}

function selectedCitations(answer: string, chunks: RetrievedChunk[]): Citation[] {
  const indexes = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)]/g)) {
    const index = Number(match[1]) - 1;
    if (Number.isInteger(index) && index >= 0 && index < chunks.length) indexes.add(index);
  }

  return [...indexes].map((index) => {
    const chunk = chunks[index];
    return {
      chunkId: chunk.chunk_id,
      documentId: chunk.document_id,
      filename: chunk.filename,
      pageNumber: chunk.page_number,
      content: chunk.content,
      // Persist the original retrieved-passage number. This keeps the model's
      // inline [n] markers bound to their true chunk after the chat is reloaded.
      orderIndex: index,
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  const dailyLimit = configuredDailyLimit();
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !authorization || !dailyLimit) {
    return jsonResponse({ error: "Function configuration is incomplete." }, 500);
  }

  let payload: ChatRequest;
  try {
    payload = (await request.json()) as ChatRequest;
  } catch {
    return jsonResponse({ error: "A JSON request body is required." }, 400);
  }

  const collectionId = typeof payload.collectionId === "string" ? payload.collectionId : "";
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const documentId = typeof payload.documentId === "string" ? payload.documentId : null;
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!isUuid(collectionId) || !isUuid(sessionId) || (documentId !== null && !isUuid(documentId))) {
    return jsonResponse({ error: "A valid collection and session id are required." }, 400);
  }
  if (question.length < 3 || question.length > 1_200) {
    return jsonResponse({ error: "Questions must be between 3 and 1,200 characters." }, 400);
  }

  const authenticated = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await authenticated.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: "Unauthorized." }, 401);

  const { data: session, error: sessionError } = await authenticated
    .from("chat_sessions")
    .select("id, collection_id")
    .eq("id", sessionId)
    .maybeSingle<SessionRecord>();
  if (sessionError || !session || session.collection_id !== collectionId) {
    return jsonResponse({ error: "Chat session not found." }, 404);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Future: add a global daily cap by also running
  // select sum(message_count) from usage_daily where usage_date = current_date
  // and short-circuiting the same way if it exceeds a app-wide threshold.
  // Not needed until this app has real, uncontrolled traffic.
  const { data: messageCount, error: usageError } = await admin.rpc("increment_usage_daily", {
    target_user_id: authData.user.id,
  });
  if (usageError || typeof messageCount !== "number") {
    console.error("usage increment failed", usageError?.message ?? "Unexpected usage count.");
    return jsonResponse({ type: "provider_error" });
  }
  if (messageCount > dailyLimit) {
    return jsonResponse({ type: "rate_limited", resetAt: nextUtcMidnight() });
  }

  const { error: userMessageError } = await authenticated
    .from("messages")
    .insert({ session_id: sessionId, role: "user", content: question });
  if (userMessageError) return jsonResponse({ type: "provider_error" });

  try {
    const queryEmbedding = await embedQuery(question);
    const { data, error: retrievalError } = await authenticated.rpc("match_collection_chunks", {
      target_collection_id: collectionId,
      query_embedding: queryEmbedding,
      similarity_threshold: SIMILARITY_THRESHOLD,
      result_limit: RETRIEVAL_LIMIT,
      target_document_id: documentId,
    });
    if (retrievalError) throw retrievalError;

    const chunks = (data ?? []) as RetrievedChunk[];
    if (!chunks.length) {
      const { error: notFoundSaveError } = await authenticated
        .from("messages")
        .insert({ session_id: sessionId, role: "assistant", content: NOT_FOUND_MESSAGE });
      if (notFoundSaveError) throw notFoundSaveError;
      return jsonResponse({ type: "answer", content: NOT_FOUND_MESSAGE, citations: [] });
    }

    let answer: string;
    try {
      answer = await generateGroundedAnswer(buildPrompt(chunks), question);
    } catch (providerError) {
      console.error("DeepSeek provider error", providerError instanceof Error ? providerError.message : "Unknown provider error");
      return jsonResponse({ type: "provider_error" });
    }

    const citations = selectedCitations(answer, chunks);
    const { data: assistantMessage, error: assistantMessageError } = await authenticated
      .from("messages")
      .insert({ session_id: sessionId, role: "assistant", content: answer })
      .select("id")
      .single<{ id: string }>();
    if (assistantMessageError || !assistantMessage) throw assistantMessageError ?? new Error("Assistant message was not saved.");

    if (citations.length) {
      const { error: citationError } = await authenticated.from("citations").insert(
        citations.map((citation) => ({
          message_id: assistantMessage.id,
          chunk_id: citation.chunkId,
          order_index: citation.orderIndex,
        })),
      );
      if (citationError) throw citationError;
    }

    return jsonResponse({ type: "answer", content: answer, citations });
  } catch (error) {
    console.error("chat failed", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ type: "provider_error" });
  }
});