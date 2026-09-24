import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
  FileText,
  MessageCircle,
  SearchX,
  Send,
  Trash2,
} from "lucide-react";
import { navigate } from "../../../app/navigation";
import { SourceViewer } from "../../../components/SourceViewer/SourceViewer";
import { CitationThreadSvg } from "../../../components/CitationThread/CitationThreadSvg";
import { Spinner } from "../../../components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { ChatResponseLoader } from "../../chat/components/ChatResponseLoader";
import { citationTargetsForAnswer, InlineCitationAnswer } from "../../chat/components/InlineCitationAnswer";
import { clearChatSession } from "../../chat/api";
import { useChatHistory } from "../../chat/hooks/useChatHistory";
import { useSendMessage } from "../../chat/hooks/useSendMessage";
import type { ChatCitation, ChatMessage, Collection } from "../types/domain";

type WorkspacePageProps = { collection: Collection };
type WorkspaceTab = "chat" | "notes";

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
  onOpenCitation: (citation: ChatCitation, trigger?: HTMLElement) => void;
}) {
  const isNotFound = message.kind === "not-found";
  const isSignal =
    message.kind === "rate-limited" || message.kind === "provider-error";
  const sourceRule = isSignal
    ? "shadow-[inset_3px_0_0_var(--signal)]"
    : "shadow-[inset_3px_0_0_var(--purple)]";
  const citationTargets = citationTargetsForAnswer(message.content, message.citations ?? []);

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
        <InlineCitationAnswer
          content={message.content}
          citations={message.citations}
          onOpenCitation={onOpenCitation}
        />
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
              onClick={(event) => onOpenCitation(citationTargets.get(citation.orderIndex + 1) ?? citation, event.currentTarget)}
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
  const [citationTrigger, setCitationTrigger] = useState<HTMLElement | null>(null);
  const [sourceHighlightElement, setSourceHighlightElement] = useState<HTMLElement | null>(null);
  const [submissionKey, setSubmissionKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [isAwayFromLatest, setIsAwayFromLatest] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const questionFormRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const chatHistory = useChatHistory(collection.id);
  const sendMessage = useSendMessage();

  useEffect(() => {
    setMessages([]);
    setSessionId(undefined);
    setActiveCitation(null);
    setCitationTrigger(null);
    setSourceHighlightElement(null);
  }, [collection.id]);

  useEffect(() => {
    if (!chatHistory.data) return;
    setSessionId((current) => current ?? chatHistory.data.sessionId);
    setMessages((current) => current.length ? current : chatHistory.data.messages);
  }, [chatHistory.data]);
  useEffect(() => {
    const scrollArea = chatScrollRef.current;
    const latestMessage = latestMessageRef.current;
    if (!scrollArea || !latestMessage || messages.length === 0) {
      setIsAwayFromLatest(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsAwayFromLatest(!entry.isIntersecting),
      { root: scrollArea, threshold: 0.9 },
    );
    observer.observe(latestMessage);
    return () => observer.disconnect();
  }, [messages.length]);

  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior });
  };

  useEffect(() => {
    window.requestAnimationFrame(() => scrollToLatest(messages.length > 2 ? "smooth" : "auto"));
  }, [messages.length]);
  const hasDocuments = collection.documents.some(
    (document) => document.status === "ready",
  );

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || !hasDocuments || isSubmitting || isClearing) return;

    setIsSubmitting(true);
    setSubmissionKey((current) => current + 1);
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
      if (response.citations[0]) {
        const firstCitation = response.citations[0];
        setActiveCitation(
          citationTargetsForAnswer(response.content, response.citations).get(firstCitation.orderIndex + 1)
            ?? firstCitation,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["chat-history", collection.id] });
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

  const clearConversation = async () => {
    setClearError("");
    setIsClearing(true);
    try {
      if (sessionId) await clearChatSession(sessionId);
      queryClient.setQueryData(["chat-history", collection.id], {
        sessionId: undefined,
        messages: [] as ChatMessage[],
      });
      setMessages([]);
      setSessionId(undefined);
      setActiveCitation(null);
    setCitationTrigger(null);
    setSourceHighlightElement(null);
      setIsClearConfirmationOpen(false);
    } catch (error) {
      setClearError(error instanceof Error ? error.message : "We could not clear this conversation.");
    } finally {
      setIsClearing(false);
    }
  };
  const openUpload = () =>
    navigate({ name: "upload", collectionId: collection.id });
  const openCitation = (citation: ChatCitation, trigger?: HTMLElement) => {
    setActiveCitation(citation);
    setCitationTrigger(trigger ?? null);
    setSourceHighlightElement(null);
    setTab("notes");
  };
  const onSourceHighlightAnchorChange = useCallback((anchor: HTMLElement | null) => {
    setSourceHighlightElement(anchor);
  }, []);

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
      <div ref={workspaceRef} className="relative grid h-[calc(100dvh-17rem)] min-h-[320px] flex-1 gap-1 overflow-hidden bg-[var(--paper)] shadow-[0_18px_42px_rgba(66,47,39,0.08)] lg:h-auto lg:min-h-[610px] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <section
          className={`${tab === "chat" ? "flex" : "hidden"} min-h-0 flex-col bg-[var(--cream)] lg:flex`}
        >
          <div className="flex h-12 items-center justify-between bg-[rgba(241,236,227,0.72)] px-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
              Conversation
            </span>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => { setClearError(""); setIsClearConfirmationOpen(true); }}
                disabled={isSubmitting || isClearing}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-[var(--muted)] transition hover:bg-white hover:text-[#963e43] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 size={13} strokeWidth={1} /> <span className="text-sm">Clear chat</span>
              </button>
            )}
          </div>
          <div className="relative min-h-0 flex-1">
            <div
              ref={chatScrollRef}
              className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
            {chatHistory.isLoading && messages.length === 0 && !isSubmitting ? (
              <div className="grid min-h-[420px] place-items-center px-6 text-center">
                <div>
                  <Spinner className="mx-auto size-5 animate-spin text-[var(--purple)]" />
                  <p className="mt-3 text-[11px] text-[var(--muted)]">Loading this conversation…</p>
                </div>
              </div>
            ) : messages.length === 0 && !isSubmitting ? (
              <EmptyChat
                hasDocuments={hasDocuments}
                onOpenUpload={openUpload}
              />
            ) : (
              <div className="space-y-5 p-5">
                <AnimatePresence initial={false} mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      {message.role === "user" ? (
                        <div className="ml-auto max-w-[85%] rounded-md bg-[var(--purple)] px-4 py-3 text-[13px] leading-6 text-white shadow-[0_8px_18px_rgba(66,47,39,0.1)]">
                          {message.content}
                        </div>
                      ) : (
                        <AssistantMessage message={message} onOpenCitation={openCitation} />
                      )}
                    </motion.div>
                  ))}

                </AnimatePresence>
                {isSubmitting && <ChatResponseLoader key={`response-loader-${submissionKey}`} />}
              </div>
            )}
            <div ref={latestMessageRef} aria-hidden="true" className="h-px" />
            </div>
            {isAwayFromLatest && messages.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToLatest()}
                className="absolute bottom-3 right-4 grid size-9 place-items-center rounded-full bg-[var(--purple)] text-white shadow-[0_8px_18px_rgba(66,47,39,0.2)] transition hover:-translate-y-px hover:bg-[var(--purple-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:ring-offset-2"
                aria-label="Scroll to newest message"
              >
                <ArrowDown size={16} strokeWidth={1} />
              </button>
            )}
          </div>
          <div className="shrink-0 bg-white">
          <form ref={questionFormRef} onSubmit={submitQuestion} className="p-3">
            <div className="flex items-end gap-2 rounded-md bg-[var(--paper)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(222,214,203,0.55)] transition focus-within:ring-4 focus-within:ring-[rgba(95,61,130,0.10)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  questionFormRef.current?.requestSubmit();
                }}
                disabled={!hasDocuments || isSubmitting || isClearing}
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
                disabled={!draft.trim() || !hasDocuments || isSubmitting || isClearing}
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
                : "Press Enter to ask · Shift+Enter for a new line."}
            </p>
          </form>
          </div>
        </section>
        <div
          className={`${tab === "notes" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:block`}
        >
          <SourceViewer collection={collection} citation={activeCitation} onHighlightAnchorChange={onSourceHighlightAnchorChange} />
        </div>
        <CitationThreadSvg
          workspaceRef={workspaceRef}
          fromElement={citationTrigger}
          toElement={sourceHighlightElement}
          label={(activeCitation?.orderIndex ?? 0) + 1}
        />
      </div>
      {isClearConfirmationOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="presentation">
          <button type="button" onClick={() => !isClearing && setIsClearConfirmationOpen(false)} className="absolute inset-0 bg-[rgba(27,25,26,0.34)] backdrop-blur-[2px]" aria-label="Cancel clearing conversation" />
          <section role="dialog" aria-modal="true" aria-labelledby="clear-conversation-title" className="relative w-full max-w-sm bg-[var(--cream)] p-6 shadow-[0_28px_90px_rgba(38,26,42,0.26)]">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#963e43]">Permanent action</p>
            <h2 id="clear-conversation-title" className="mt-3 font-[var(--serif)] text-[19px] font-light tracking-[-0.045em] text-[var(--ink)]">Clear this conversation?</h2>
            <p className="mt-3 text-[13px] leading-6 text-[var(--body)]">This removes this chat’s messages and citation history. Your documents and collection stay untouched.</p>
            {clearError && <p className="mt-3 text-[12px] text-[var(--signal)]" role="alert">{clearError}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setIsClearConfirmationOpen(false)} disabled={isClearing} className="h-10 rounded-md px-3 text-[12px] font-medium text-[var(--body)] transition hover:bg-[var(--paper)] disabled:opacity-50">Keep chat</button>
              <button type="button" onClick={() => void clearConversation()} disabled={isClearing} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#963e43] px-4 text-[12px] font-medium text-white transition hover:-translate-y-px hover:bg-[#783034] disabled:cursor-wait disabled:opacity-70">
                {isClearing ? <><Spinner className="size-3.5 animate-spin" /> Clearing…</> : <><Trash2 size={14} strokeWidth={1} /> Clear chat</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}