import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Book,
  FileText,
  MessageCircle,
  SearchX,
  Send,
} from "lucide-react";
import { navigate } from "../../../app/navigation";
import { Spinner } from "../../../components/ui/spinner";
import { useSendMessage } from "../../chat/hooks/useSendMessage";
import type { ChatCitation, ChatMessage, Collection } from "../types/domain";

type WorkspacePageProps = { collection: Collection };
type WorkspaceTab = "chat" | "notes";

function SourcePane({
  collection,
  citation,
}: {
  collection: Collection;
  citation: ChatCitation | null;
}) {
  const document = citation
    ? (collection.documents.find((item) => item.id === citation.documentId) ??
      collection.documents[0])
    : collection.documents[0];

  if (!document) {
    return (
      <section className="grid min-h-[420px] place-items-center bg-[#f5f0e8] p-8 text-center text-[#332c2d]">
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e9dfd1] text-[var(--purple)]">
            <Book size={20} strokeWidth={1}/>
          </div>
          <h2 className="mt-4 font-[var(--serif)] text-[15px] font-light leading-none tracking-[-0.055em]">
            No notes to read yet.
          </h2>
          <p className="mt-3 max-w-xs text-[13px] leading-6 text-[#756b64]">
            Add a text-based PDF or note before opening a conversation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full bg-[#f5f0e8] text-[#332c2d]">
      <div className="flex h-12 items-center justify-between bg-[rgba(223,212,197,0.45)] px-4">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-[#776d65]">
          <FileText size={14} strokeWidth={1}/>
          <span className="truncate">{document.filename}</span>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#91857a]">
          Source
        </span>
      </div>
      <article className="mx-auto max-w-2xl px-6 py-10 sm:px-10">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#92867b]">
          {citation
            ? `Cited passage${citation.pageNumber ? ` · page ${citation.pageNumber}` : ""}`
            : "Select a citation"}
        </p>
        <h2 className="mt-4 font-[var(--serif)] text-[15px] font-light leading-none tracking-[-0.045em]">
          {citation
            ? "The passage behind the answer."
            : "Your sources stay close to the conversation."}
        </h2>
        <div className="my-8 h-px bg-[#dcd0c2]" />
        {citation ? (
          <p className="bg-[rgba(156,115,200,0.14)] px-4 py-3 shadow-[inset_3px_0_0_var(--purple)] font-[var(--serif)] text-[15px] leading-7 text-[#4d3a56]">
            {citation.content}
          </p>
        ) : (
          <p className="font-[var(--serif)] text-[15px] leading-8 text-[#574a45]">
            Ask a question, then choose one of its citations to bring the exact
            retrieved passage into view here.
          </p>
        )}
        <p className="mt-8 text-[13px] leading-6 text-[#756b64]">
          {citation
            ? "This is the chunk sent to the model for the answer above."
            : "NotesRAG only sends retrieved passages into the answer step."}
        </p>
      </article>
    </section>
  );
}

function EmptyChat({
  onOpenUpload,
  hasDocuments,
}: {
  onOpenUpload: () => void;
  hasDocuments: boolean;
}) {
  return (
    <div className="grid min-h-[420px] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--lilac)] text-[var(--purple)]">
          <MessageCircle size={20} strokeWidth={1}/>
        </div>
        <p className="mt-5 text-[10px] font-semibold tracking-[0.13em] text-[var(--purple)]">
          {hasDocuments ? "No messages yet" : "No documents yet"}
        </p>
        <h2 className="mt-3 font-[var(--serif)] text-[15px] font-light leading-none tracking-[-0.045em]">
          {hasDocuments
            ? "Start with what you want to understand."
            : "Bring in a source first."}
        </h2>
        <p className="mt-4 text-[13px] leading-6 text-[var(--body)]">
          {hasDocuments
            ? "Ask a focused question and NotesRAG will only answer from the passages it retrieves."
            : "Add a text-based PDF or plain note before starting a source-grounded conversation."}
        </p>
        <button
          type="button"
          onClick={onOpenUpload}
          className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-[var(--purple)] hover:text-[var(--purple-dark)]"
        >
          <span className="text-sm">{hasDocuments ? "Add more notes" : "Add source material"}{" "}</span>
          <ArrowUpRight size={14} strokeWidth={1} />
        </button>
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  onOpenCitation,
}: {
  message: ChatMessage;
  onOpenCitation: (citation: ChatCitation) => void;
}) {
  const isNotFound = message.kind === "not-found";
  const isSignal =
    message.kind === "rate-limited" || message.kind === "provider-error";
  const sourceRule = isSignal
    ? "shadow-[inset_3px_0_0_var(--signal)]"
    : "shadow-[inset_3px_0_0_var(--purple)]";

  return (
    <div className={`max-w-[92%] bg-[var(--paper)] px-4 py-3 ${sourceRule}`}>
      <p
        className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isSignal ? "text-[var(--signal)]" : "text-[var(--purple)]"}`}
      >
        {isSignal ? (
          <AlertCircle size={13} />
        ) : isNotFound ? (
          <SearchX size={13} strokeWidth={1} />
        ) : (
          <MessageCircle size={13} strokeWidth={1} />
        )}
        {isNotFound
          ? "Not found in your notes"
          : isSignal
            ? "Chat unavailable"
            : "NotesRAG"}
      </p>
      <p className="text-[13px] leading-6 text-[var(--body)]">
        {message.content}
      </p>
      {isNotFound && (
        <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
          No generation was used because the collection did not return a
          relevant passage.
        </p>
      )}
      {!!message.citations?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.citations.map((citation) => (
            <button
              key={citation.chunkId}
              type="button"
              onClick={() => onOpenCitation(citation)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[10px] text-[var(--purple)] shadow-[0_2px_7px_rgba(66,47,39,0.07)] transition hover:-translate-y-px hover:text-[var(--purple-dark)]"
            >
              <span className="grid size-4 place-items-center rounded-full bg-[var(--lilac)] text-[9px] font-semibold">
                {citation.orderIndex + 1}
              </span>
              {citation.filename}
              {citation.pageNumber ? ` · p. ${citation.pageNumber}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkspacePage({ collection }: WorkspacePageProps) {
  const [tab, setTab] = useState<WorkspaceTab>("chat");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sendMessage = useSendMessage();
  const hasDocuments = collection.documents.some(
    (document) => document.status === "ready",
  );

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || !hasDocuments || isSubmitting) return;

    setIsSubmitting(true);
    setDraft("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: question },
    ]);
    try {
      const result = await sendMessage.mutateAsync({
        collectionId: collection.id,
        sessionId,
        question,
      });
      setSessionId(result.sessionId);
      const response = result.response;
      if (response.type === "rate_limited") {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            kind: "rate-limited",
            content: "You’ve reached today’s limit — resets at midnight UTC.",
          },
        ]);
        return;
      }
      if (response.type === "provider_error") {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            kind: "provider-error",
            content:
              "Something went wrong reaching the model — try again in a moment.",
          },
        ]);
        return;
      }

      const kind = response.citations.length ? undefined : "not-found";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind,
          content: response.content,
          citations: response.citations,
        },
      ]);
      if (response.citations[0]) setActiveCitation(response.citations[0]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          kind: "provider-error",
          content:
            "Something went wrong reaching the model — try again in a moment.",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUpload = () =>
    navigate({ name: "upload", collectionId: collection.id });
  const openCitation = (citation: ChatCitation) => {
    setActiveCitation(citation);
    setTab("notes");
  };

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:h-[calc(100vh-6.75rem)] lg:px-9 lg:py-7">
      <div className="mb-4 flex items-center justify-between lg:mb-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-[var(--purple)]">
            Collection workspace
          </p>
          <h1 className="mt-4 font-[var(--serif)] text-[20px] font-light leading-none tracking-wide">
            {collection.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={openUpload}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-white px-3.5 shadow-[0_5px_14px_rgba(66,47,39,0.07)] text-[12px] font-medium text-[var(--ink)] transition duration-200 ease-out hover:-translate-y-px hover:border-[var(--purple)] hover:text-[var(--purple)] active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
        >
          <FileText size={15} strokeWidth={1}/> <span className="text-sm">Add notes</span>
        </button>
      </div>
      <div className="mb-3 grid grid-cols-2 bg-[var(--paper)] p-1 shadow-[0_6px_16px_rgba(66,47,39,0.05)] lg:hidden">
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={`h-9 text-[12px] transition-all duration-200 ease-out hover:bg-[rgba(95,61,130,0.08)] ${tab === "chat" ? "bg-[var(--purple)] text-white" : "text-[var(--body)]"}`}
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => setTab("notes")}
          className={`h-9 text-[12px] transition-all duration-200 ease-out hover:bg-[rgba(95,61,130,0.08)] ${tab === "notes" ? "bg-[var(--purple)] text-white" : "text-[var(--body)]"}`}
        >
          Notes
        </button>
      </div>
      <div className="grid min-h-[610px] flex-1 gap-1 overflow-hidden bg-[var(--paper)] shadow-[0_18px_42px_rgba(66,47,39,0.08)] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <section
          className={`${tab === "chat" ? "block" : "hidden"} min-h-0 bg-[var(--cream)] lg:flex lg:flex-col`}
        >
          <div className="flex h-12 items-center justify-between bg-[rgba(241,236,227,0.72)] px-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
              Conversation
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <EmptyChat
                hasDocuments={hasDocuments}
                onOpenUpload={openUpload}
              />
            ) : (
              <div className="space-y-5 p-5">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div
                      key={message.id}
                      className="ml-auto max-w-[85%] rounded-md bg-[var(--purple)] px-4 py-3 text-[13px] leading-6 text-white"
                    >
                      {message.content}
                    </div>
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      onOpenCitation={openCitation}
                    />
                  ),
                )}
              </div>
            )}
          </div>
          <form onSubmit={submitQuestion} className="bg-white p-3">
            <div className="flex items-end gap-2 rounded-md bg-[var(--paper)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(222,214,203,0.55)] transition focus-within:ring-4 focus-within:ring-[rgba(95,61,130,0.10)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={!hasDocuments || isSubmitting}
                rows={1}
                placeholder={
                  hasDocuments
                    ? "Ask about your notes…"
                    : "Add notes before asking a question"
                }
                className="max-h-28 min-h-7 flex-1 resize-none bg-transparent py-1 text-[13px] leading-5 outline-none placeholder:text-[#aaa19a] disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !hasDocuments || isSubmitting}
                className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--purple)] text-white transition duration-200 ease-out hover:-translate-y-px hover:bg-[var(--purple-dark)] active:translate-y-0 disabled:cursor-wait disabled:bg-[#c4b6cf]"
                aria-label="Ask"
              >
                <span className="sr-only">Ask</span>
                {isSubmitting ? (
                  <Spinner className="size-4 animate-spin" />
                ) : (
                  <Send size={14} strokeWidth={1}/>
                )}
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-[var(--muted)]">
              {isSubmitting
                ? "Searching your notes…"
                : "Answers are limited to retrieved passages and carry their source."}
            </p>
          </form>
        </section>
        <div
          className={`${tab === "notes" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:block`}
        >
          <SourcePane collection={collection} citation={activeCitation} />
        </div>
      </div>
    </main>
  );
}
