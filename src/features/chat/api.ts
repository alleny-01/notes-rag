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
  onDelta?: (content: string) => void;
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

type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "answer"; content: string; citations: ChatCitation[] }
  | { type: "provider_error" };

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

function chatFunctionUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!baseUrl) throw new Error("VITE_SUPABASE_URL is not configured.");
  return `${baseUrl.replace(/\/$/, "")}/functions/v1/chat`;
}

async function readStreamedChat(response: Response, onDelta?: (content: string) => void): Promise<ChatEndpointResponse> {
  if (!response.body) throw new Error("The chat response did not include a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      const data = eventBlock
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!data) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(data) as StreamEvent;
      } catch {
        continue;
      }
      if (event.type === "delta") {
        content += event.content;
        onDelta?.(content);
        continue;
      }
      if (event.type === "provider_error") return event;
      return { type: "answer", content: event.content || content, citations: event.citations };
    }
  }

  throw new Error("The answer stream ended before it completed.");
}

export async function sendChatMessage({
  collectionId,
  sessionId,
  question,
  documentId,
  onDelta,
}: SendMessageInput): Promise<SendMessageResult> {
  const resolvedSessionId = sessionId ?? await createChatSession(collectionId);
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!accessToken || !publishableKey) throw new Error("Your session is unavailable. Please sign in again.");

  const response = await fetch(chatFunctionUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    },
    body: JSON.stringify({ collectionId, sessionId: resolvedSessionId, question, documentId }),
  });
  if (!response.ok) throw new Error("We could not send that question.");

  const responseType = response.headers.get("content-type") ?? "";
  const payload = responseType.includes("text/event-stream")
    ? await readStreamedChat(response, onDelta)
    : await response.json() as ChatEndpointResponse;
  return { sessionId: resolvedSessionId, response: payload };
}