import { supabase } from "../../lib/supabaseClient";
import type { ChatCitation } from "../collections/types/domain";

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

async function createChatSession(collectionId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ collection_id: collectionId })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(error?.message ?? "We could not start a chat session.");
  return data.id;
}

export async function sendChatMessage({ collectionId, sessionId, question, documentId }: SendMessageInput): Promise<SendMessageResult> {
  const resolvedSessionId = sessionId ?? await createChatSession(collectionId);
  const { data, error } = await supabase.functions.invoke<ChatEndpointResponse>("chat", {
    body: { collectionId, sessionId: resolvedSessionId, question, documentId },
  });
  if (error || !data) throw new Error(error?.message ?? "We could not send that question.");
  return { sessionId: resolvedSessionId, response: data };
}