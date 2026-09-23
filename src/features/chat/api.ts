import { supabase } from "../../lib/supabaseClient";
import type { ChatCitation, ChatMessage } from "../collections/types/domain";

export type ChatEndpointResponse =
  | { type: "answer"; content: string; citations: ChatCitation[] }
  | { type: "rate_limited"; resetAt: string }
  | { type: "provider_error" };

type SendMessageInput = {
  collectionId: string;
  sessionId?: string;
  question: string;
  documentId?: string;
};

export type SendMessageResult = {
  sessionId: string;
  response: ChatEndpointResponse;
};

type ChatSessionRow = { id: string };
type ChatHistoryRow = {
  id: string;
  role: ChatMessage["role"];
  content: string;
  citations?: Array<{
    order_index: number;
    chunks?: {
      id: string;
      content: string;
      page_number: number | null;
      documents?: { id: string; filename: string } | null;
    } | null;
  }>;
};

function toChatMessage(row: ChatHistoryRow): ChatMessage {
  const citations = (row.citations ?? [])
    .flatMap((citation) => {
      const chunk = citation.chunks;
      const document = chunk?.documents;
      if (!chunk || !document) return [];
      return [{
        chunkId: chunk.id,
        documentId: document.id,
        filename: document.filename,
        pageNumber: chunk.page_number,
        content: chunk.content,
        orderIndex: citation.order_index,
      } satisfies ChatCitation];
    })
    .sort((left, right) => left.orderIndex - right.orderIndex);

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: citations.length ? citations : undefined,
  };
}

async function createChatSession(collectionId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ collection_id: collectionId })
    .select("id")
    .single<ChatSessionRow>();
  if (error || !data) throw new Error(error?.message ?? "We could not start a chat session.");
  return data.id;
}

export async function loadLatestChat(collectionId: string) {
  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChatSessionRow>();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return { sessionId: undefined, messages: [] as ChatMessage[] };

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at, citations(order_index, chunks(id, content, page_number, documents(id, filename)))")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    sessionId: session.id,
    messages: ((data ?? []) as unknown as ChatHistoryRow[]).map(toChatMessage),
  };
}

export async function clearChatSession(sessionId: string) {
  const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
}
export async function sendChatMessage({ collectionId, sessionId, question, documentId }: SendMessageInput): Promise<SendMessageResult> {
  const resolvedSessionId = sessionId ?? await createChatSession(collectionId);
  const { data, error } = await supabase.functions.invoke<ChatEndpointResponse>("chat", {
    body: { collectionId, sessionId: resolvedSessionId, question, documentId },
  });
  if (error || !data) throw new Error(error?.message ?? "We could not send that question.");
  return { sessionId: resolvedSessionId, response: data };
}
