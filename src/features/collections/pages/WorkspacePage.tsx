import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  Copy,
  FileText,
  MessageCircle,
  OctagonX,
  SearchX,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { navigate } from "../../../app/navigation";
import { createClientId } from "../../../lib/clientId";
import { SourceViewer } from "../../../components/SourceViewer/SourceViewer";
import { CitationThreadSvg } from "../../../components/CitationThread/CitationThreadSvg";
import { Spinner } from "../../../components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { ChatResponseLoader } from "../../chat/components/ChatResponseLoader";
import { InlineCitationAnswer } from "../../chat/components/InlineCitationAnswer";
import { citationTargetsForAnswer } from "../../chat/citationMap";
import { clearChatSession } from "../../chat/api";
import { useChatHistory } from "../../chat/hooks/useChatHistory";
import { useSendMessage } from "../../chat/hooks/useSendMessage";
import type { ChatCitation, ChatMessage, Collection } from "../types/domain";
import { useToast } from "../../../components/ui/ToastProvider";
import { localResetTime } from "../../settings/settings";
import { useSettings } from "../../settings/hooks/useSettings";

type WorkspacePageProps = {
  collection: Collection;
  onTrySample?: () => Promise<void>;
};
type WorkspaceTab = "chat" | "notes";

const starterQuestions = [
  "Summarize this",
  "List the key terms",
  "What are the main arguments?",
  "Quiz me on this",
];

function EmptyChat({
  onOpenUpload,
  hasDocuments,
  documents,
  onStarterQuestion,
  onTrySample,
}: {
  onOpenUpload: () => void;
  hasDocuments: boolean;
  documents: Collection["documents"];
  onStarterQuestion: (question: string) => void;
  onTrySample?: () => Promise<void>;
}) {
  const ready = documents.find((document) => document.status === "ready");
  const indexing = documents.find(
    (document) =>
      document.status === "pending" || document.status === "embedding",
  );
  if (hasDocuments)
    return (
      <div className="grid min-h-[420px] place-items-center p-5 text-center sm:p-7">
        <div className="w-full max-w-xl">
          <div className="flex items-center gap-3 rounded-md bg-white px-4 py-3 text-left shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--paper)] text-[var(--purple)]">
              <FileText size={18} strokeWidth={1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-[var(--ink)]">
                {ready?.filename ?? indexing?.filename ?? "Your notes"}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {ready
                  ? `${ready.chunkCount ?? "Your"} passages indexed`
                  : "Indexing your source…"}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] ${ready ? "bg-[var(--lilac)] text-[var(--purple)]" : "bg-[var(--paper)] text-[var(--body)]"}`}
            >
              {ready ? "✓ Ready" : "Indexing"}
            </span>
          </div>
          <h2 className="mt-9 font-[var(--serif)] text-[21px] font-light tracking-[-0.045em]">
            What do you want to understand?
          </h2>
          <p className="mt-2 text-[13px] text-[var(--body)]">
            Every answer cites the exact passage it came from.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {starterQuestions.map((question, index) => (
              <motion.button
                key={question}
                type="button"
                disabled={!ready}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: index * 0.045 }}
                onClick={() => onStarterQuestion(question)}
                className="rounded-full bg-white px-4 py-2 text-[12px] text-[var(--body)] shadow-[inset_0_0_0_1px_var(--line)] transition hover:-translate-y-px hover:text-[var(--purple)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </motion.button>
            ))}
          </div>
          {!ready && (
            <p className="mt-4 text-[11px] text-[var(--muted)]">
              Starter questions become available once indexing is ready.
            </p>
          )}
        </div>
      </div>
    );
  return (
    <div className="grid min-h-[420px] place-items-center p-5 text-center sm:p-7">
      <div className="w-full max-w-xl">
        <div className="rounded-md border border-dashed border-[rgba(95,61,130,0.5)] bg-[var(--cream)] px-5 py-9 transition hover:scale-[1.01] hover:bg-[#f3ecfa] sm:px-9">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--lilac)] text-[var(--purple)]">
            <Upload size={24} strokeWidth={1} />
          </div>
          <h2 className="mt-6 font-[var(--serif)] text-[22px] font-light tracking-[-0.045em]">
            Start with your notes
          </h2>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            PDF, Markdown or text. Up to 20 MB.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--purple)] px-4 text-[12px] text-white transition hover:-translate-y-px hover:bg-[var(--purple-dark)]"
            >
              <Upload size={15} strokeWidth={1} />
              Choose files
            </button>
            <button
              type="button"
              onClick={() => void onTrySample?.()}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-[12px] text-[var(--purple)] shadow-[inset_0_0_0_1px_var(--purple)] transition hover:-translate-y-px hover:bg-[var(--lilac)]"
            >
              <Sparkles size={15} strokeWidth={1} />
              Try sample notes
            </button>
          </div>
        </div>
        <ol className="mt-7 space-y-4 text-left">
          {[
            "Add a source",
            "Ask a question",
            "Tap a citation to see the page",
          ].map((step, index) => (
            <li
              key={step}
              className={`flex items-center gap-3 text-[13px] ${index === 0 ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}
            >
              <span
                className={`grid size-7 place-items-center rounded-full text-[11px] ${index === 0 ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line)]"}`}
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  onOpenCitation,
  onCopy,
  onRetry,
  onFeedback,
}: {
  message: ChatMessage;
  onOpenCitation: (citation: ChatCitation, trigger?: HTMLElement) => void;
  onCopy: (message: ChatMessage) => void;
  onRetry?: () => void;
  onFeedback?: (rating: "up" | "down") => void;
}) {
  const isNotFound = message.kind === "not-found";
  const isSignal =
    message.kind === "rate-limited" || message.kind === "provider-error";
  const sourceRule = isSignal
    ? "shadow-[inset_3px_0_0_var(--signal)]"
    : "shadow-[inset_3px_0_0_var(--purple)]";
  const citationTargets = citationTargetsForAnswer(
    message.content,
    message.citations ?? [],
  );

  return (
    <div
      data-message-id={message.id}
      className={`max-w-[92%] bg-[var(--paper)] px-4 py-3 ${sourceRule}`}
    >
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
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-6 text-[var(--body)]">
          <InlineCitationAnswer
            content={message.content}
            citations={message.citations}
            onOpenCitation={onOpenCitation}
          />
        </p>
        {!isSignal && (
          <button
            type="button"
            onClick={() => onCopy(message)}
            className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--muted)] transition hover:bg-white hover:text-[var(--purple)]"
            aria-label="Copy answer"
          >
            <Copy size={14} strokeWidth={1} />
          </button>
        )}
      </div>
      {isNotFound && (
        <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
          No generation was used because the collection did not return a
          relevant passage.
        </p>
      )}
      {message.kind === "stopped" && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Stopped before the answer was complete.
        </p>
      )}
      {message.kind === "provider-error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-8 rounded-md bg-white px-3 text-[11px] text-[var(--purple)] shadow-[inset_0_0_0_1px_var(--line)] transition hover:bg-[var(--lilac)]"
        >
          Retry
        </button>
      )}
      {onFeedback && !isSignal && !isNotFound && (
        <div className="mt-3 flex gap-1">
          <button
            type="button"
            onClick={() => onFeedback("up")}
            aria-label="Helpful answer"
            className="rounded px-2 py-1 text-[11px] text-[var(--muted)] transition hover:bg-white hover:text-[var(--purple)]"
          >
            Helpful
          </button>
          <button
            type="button"
            onClick={() => onFeedback("down")}
            aria-label="Unhelpful answer"
            className="rounded px-2 py-1 text-[11px] text-[var(--muted)] transition hover:bg-white hover:text-[var(--signal)]"
          >
            Needs work
          </button>
        </div>
      )}
      {!!message.citations?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.citations.map((citation) => (
            <button
              key={citation.chunkId}
              type="button"
              onClick={(event) =>
                onOpenCitation(
                  citationTargets.get(citation.orderIndex + 1) ?? citation,
                  event.currentTarget,
                )
              }
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

export function WorkspacePage({ collection, onTrySample }: WorkspacePageProps) {
  const [tab, setTab] = useState<WorkspaceTab>("chat");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(
    null,
  );
  const [citationTrigger, setCitationTrigger] = useState<HTMLElement | null>(
    null,
  );
  const [citationAnimationKey, setCitationAnimationKey] = useState(0);
  const [sourceHighlightElement, setSourceHighlightElement] =
    useState<HTMLElement | null>(null);
  const [submissionKey, setSubmissionKey] = useState(0);
  const [streamingContent, setStreamingContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [isAwayFromLatest, setIsAwayFromLatest] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number }>();
  const [completedAnnouncement, setCompletedAnnouncement] = useState("");
  const [mobileCitationPreview, setMobileCitationPreview] =
    useState<ChatCitation | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToChatBottomRef = useRef(true);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const questionFormRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const chatHistory = useChatHistory(collection.id);
  const sendMessage = useSendMessage();
  const { showToast } = useToast();
  const { settings } = useSettings();

  useEffect(() => {
    setMessages([]);
    setSessionId(undefined);
    setActiveCitation(null);
    setCitationTrigger(null);
    setSourceHighlightElement(null);
  }, [collection.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.matches(
        "input, textarea, [contenteditable=true]",
      );
      if (event.key === "/" && !editable) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
      if (event.key === "Escape") {
        setActiveCitation(null);
        setCitationTrigger(null);
        setSourceHighlightElement(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!chatHistory.data) return;
    setSessionId((current) => current ?? chatHistory.data.sessionId);
    setMessages((current) =>
      current.length ? current : chatHistory.data.messages,
    );
  }, [chatHistory.data]);
  useEffect(() => {
    const scrollArea = chatScrollRef.current;
    const latestMessage = latestMessageRef.current;
    if (!scrollArea || !latestMessage || messages.length === 0) {
      setIsAwayFromLatest(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        shouldStickToChatBottomRef.current = entry.isIntersecting;
        setIsAwayFromLatest(!entry.isIntersecting);
      },
      { root: scrollArea, threshold: 0.9 },
    );
    observer.observe(latestMessage);
    return () => observer.disconnect();
  }, [messages.length]);

  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    shouldStickToChatBottomRef.current = true;
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior,
    });
  };

  const handleChatScroll = () => {
    const scrollArea = chatScrollRef.current;
    if (!scrollArea) return;

    const distanceFromBottom =
      scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    const isAtBottom = distanceFromBottom < 28;
    shouldStickToChatBottomRef.current = isAtBottom;
    setIsAwayFromLatest(!isAtBottom);
  };

  useEffect(() => {
    if (!shouldStickToChatBottomRef.current) return;
    window.requestAnimationFrame(() =>
      scrollToLatest(messages.length > 2 ? "smooth" : "auto"),
    );
  }, [messages.length, streamingContent]);
  const hasDocuments = collection.documents.some(
    (document) => document.status === "ready",
  );
  const hasSources = collection.documents.length > 0;

  const submitQuestion = async (
    event?: FormEvent<HTMLFormElement>,
    retryQuestion?: string,
  ) => {
    event?.preventDefault();
    const question = (retryQuestion ?? draft).trim();
    if (!question || !hasDocuments || isSubmitting || isClearing) return;

    setIsSubmitting(true);
    setSubmissionKey((current) => current + 1);
    setStreamingContent("");
    setDraft("");
    setLastQuestion(question);
    if (!retryQuestion)
      setMessages((current) => [
        ...current,
        { id: createClientId(), role: "user", content: question },
      ]);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const result = await sendMessage.mutateAsync({
        collectionId: collection.id,
        sessionId,
        question,
        onDelta: setStreamingContent,
        answerStyle: settings.answerStyle,
        signal: controller.signal,
      });
      setSessionId(result.sessionId);
      const response = result.response;
      if (response.type !== "provider_error" && response.usage)
        setUsage(response.usage);
      if (response.type === "rate_limited") {
        setMessages((current) => [
          ...current,
          {
            id: createClientId(),
            role: "assistant",
            kind: "rate-limited",
            content: `You’ve reached today’s limit — resets at ${localResetTime(response.resetAt)}.`,
          },
        ]);
        return;
      }
      if (response.type === "provider_error") {
        setMessages((current) => [
          ...current,
          {
            id: createClientId(),
            role: "assistant",
            kind: "provider-error",
            content:
              "Something went wrong reaching the model — try again in a moment.",
          },
        ]);
        return;
      }

      const kind = response.citations.length ? undefined : "not-found";
      const assistantMessageId = createClientId();
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: "assistant",
          kind,
          content: response.content,
          citations: response.citations,
        },
      ]);
      setCompletedAnnouncement("Answer complete.");
      const firstMarker = response.content.match(/\[(\d+)\]/);
      const firstCitation =
        response.citations.find(
          (citation) => citation.orderIndex + 1 === Number(firstMarker?.[1]),
        ) ?? response.citations[0];
      if (firstCitation) {
        const firstTarget =
          citationTargetsForAnswer(response.content, response.citations).get(
            firstCitation.orderIndex + 1,
          ) ?? firstCitation;
        setActiveCitation(firstTarget);
        setCitationAnimationKey((current) => current + 1);
        setSourceHighlightElement(null);
        window.requestAnimationFrame(() => {
          const trigger = workspaceRef.current?.querySelector<HTMLElement>(
            `[data-message-id="${assistantMessageId}"] [data-citation-order="${firstCitation.orderIndex}"]`,
          );
          setCitationTrigger(trigger ?? null);
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ["chat-history", collection.id],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((current) =>
          streamingContent
            ? [
                ...current,
                {
                  id: createClientId(),
                  role: "assistant",
                  kind: "stopped",
                  content: streamingContent,
                },
              ]
            : current,
        );
        return;
      }
      setMessages((current) => [
        ...current,
        {
          id: createClientId(),
          role: "assistant",
          kind: "provider-error",
          content:
            "Something went wrong reaching the model — try again in a moment.",
        },
      ]);
    } finally {
      abortControllerRef.current = null;
      setStreamingContent("");
      setIsSubmitting(false);
    }
  };

  const stopGenerating = () => abortControllerRef.current?.abort();
  const copyAnswer = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      showToast("Copied");
    } catch {
      showToast("We could not copy that answer.", "error");
    }
  };
  const saveFeedback = async (message: ChatMessage, rating: "up" | "down") => {
    const { supabase } = await import("../../../lib/supabaseClient");
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const reason =
      rating === "down"
        ? (window.prompt(
            "What needs work? Wrong citation, not in my notes, or other.",
          ) ?? undefined)
        : undefined;
    const { error } = await supabase
      .from("answer_feedback")
      .upsert(
        { message_id: message.id, user_id: data.user.id, rating, reason },
        { onConflict: "message_id,user_id" },
      );
    showToast(
      error ? "We could not save feedback." : "Thanks for the feedback.",
      error ? "error" : "success",
    );
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
      setClearError(
        error instanceof Error
          ? error.message
          : "We could not clear this conversation.",
      );
    } finally {
      setIsClearing(false);
    }
  };
  const openUpload = () =>
    navigate({ name: "upload", collectionId: collection.id });
  const openCitation = (citation: ChatCitation, trigger?: HTMLElement) => {
    setActiveCitation(citation);
    setCitationAnimationKey((current) => current + 1);
    setCitationTrigger(trigger ?? null);
    setSourceHighlightElement(null);
    if (window.matchMedia("(max-width: 1023px)").matches)
      setMobileCitationPreview(citation);
    else setTab("notes");
  };
  const onSourceHighlightAnchorChange = useCallback(
    (anchor: HTMLElement | null) => {
      setSourceHighlightElement(anchor);
    },
    [],
  );

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
          <FileText size={15} strokeWidth={1} />{" "}
          <span className="text-sm">Add notes</span>
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
      <div
        ref={workspaceRef}
        className="relative grid h-[calc(100dvh-17rem)] min-h-[320px] flex-1 gap-1 overflow-hidden bg-[var(--paper)] shadow-[0_18px_42px_rgba(66,47,39,0.08)] lg:h-auto lg:min-h-[610px] lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]"
      >
        <section
          className={`${tab === "chat" ? "flex" : "hidden"} h-full min-h-0 flex-col bg-[var(--cream)] lg:flex`}
        >
          <div className="flex h-12 items-center justify-between bg-[rgba(241,236,227,0.72)] px-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
              Conversation
            </span>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setClearError("");
                  setIsClearConfirmationOpen(true);
                }}
                disabled={isSubmitting || isClearing}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-[var(--muted)] transition hover:bg-white hover:text-[#963e43] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 size={13} strokeWidth={1} />{" "}
                <span className="text-sm">Clear chat</span>
              </button>
            )}
          </div>
          <div className="relative min-h-0 flex-1">
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="absolute inset-0 min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {chatHistory.isLoading &&
              messages.length === 0 &&
              !isSubmitting ? (
                <div className="grid min-h-[420px] place-items-center px-6 text-center">
                  <div>
                    <Spinner className="mx-auto size-5 animate-spin text-[var(--purple)]" />
                    <p className="mt-3 text-[11px] text-[var(--muted)]">
                      Loading this conversation…
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 && !isSubmitting ? (
                <EmptyChat
                  hasDocuments={hasSources}
                  onOpenUpload={openUpload}
                  documents={collection.documents}
                  onStarterQuestion={(question) => {
                    setDraft(question);
                    window.requestAnimationFrame(() =>
                      textareaRef.current?.focus(),
                    );
                  }}
                  onTrySample={onTrySample}
                />
              ) : (
                <div
                  className="space-y-5 p-5"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-busy={isSubmitting}
                >
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
                          <AssistantMessage
                            message={message}
                            onOpenCitation={openCitation}
                            onCopy={copyAnswer}
                            onRetry={
                              message.kind === "provider-error" && lastQuestion
                                ? () =>
                                    void submitQuestion(undefined, lastQuestion)
                                : undefined
                            }
                            onFeedback={
                              !message.id.startsWith("streaming-")
                                ? (rating) => void saveFeedback(message, rating)
                                : undefined
                            }
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isSubmitting && !streamingContent && (
                    <ChatResponseLoader
                      key={`response-loader-${submissionKey}`}
                      stage="searching"
                    />
                  )}
                  {isSubmitting && streamingContent && (
                    <motion.div
                      key={`streaming-answer-${submissionKey}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <AssistantMessage
                        message={{
                          id: `streaming-${submissionKey}`,
                          role: "assistant",
                          content: streamingContent,
                        }}
                        onOpenCitation={openCitation}
                        onCopy={copyAnswer}
                      />
                    </motion.div>
                  )}
                </div>
              )}
              <div ref={latestMessageRef} aria-hidden="true" className="h-px" />
            </div>
            {isAwayFromLatest && messages.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToLatest()}
                className="absolute bottom-3 right-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--purple)] px-3 text-[11px] text-white shadow-[0_8px_18px_rgba(66,47,39,0.2)] transition hover:-translate-y-px hover:bg-[var(--purple-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:ring-offset-2"
                aria-label="Scroll to newest message"
              >
                New message <ArrowDown size={14} strokeWidth={1} />
              </button>
            )}
          </div>
          <div className="shrink-0 bg-white">
            <form
              ref={questionFormRef}
              onSubmit={submitQuestion}
              className="p-3"
            >
              <div className="flex items-end gap-2 rounded-md bg-[var(--paper)] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(222,214,203,0.55)] transition focus-within:ring-4 focus-within:ring-[rgba(95,61,130,0.10)]">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "Enter" ||
                      event.shiftKey ||
                      event.nativeEvent.isComposing
                    )
                      return;
                    event.preventDefault();
                    questionFormRef.current?.requestSubmit();
                  }}
                  ref={textareaRef}
                  disabled={!hasDocuments || isClearing}
                  rows={1}
                  placeholder={
                    hasDocuments
                      ? "Ask about your notes…"
                      : "Add notes before asking a question"
                  }
                  className="max-h-28 min-h-7 flex-1 resize-none bg-transparent py-1 text-[13px] leading-5 outline-none placeholder:text-[#aaa19a] disabled:cursor-not-allowed"
                />
                <button
                  type={isSubmitting ? "button" : "submit"}
                  onClick={isSubmitting ? stopGenerating : undefined}
                  disabled={
                    isSubmitting
                      ? false
                      : !draft.trim() || !hasDocuments || isClearing
                  }
                  className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--purple)] text-white transition duration-200 ease-out hover:-translate-y-px hover:bg-[var(--purple-dark)] active:translate-y-0 disabled:cursor-wait disabled:bg-[#c4b6cf]"
                  aria-label={isSubmitting ? "Stop generating" : "Ask"}
                >
                  <span className="sr-only">
                    {isSubmitting ? "Stop" : "Ask"}
                  </span>
                  {isSubmitting ? (
                    <OctagonX className="size-4" strokeWidth={1} />
                  ) : (
                    <Send size={14} strokeWidth={1} />
                  )}
                </button>
              </div>
              <p className="mt-2 px-1 text-[10px] text-[var(--muted)]">
                {isSubmitting ? (
                  streamingContent ? (
                    "Writing answer…"
                  ) : (
                    "Searching your notes…"
                  )
                ) : (
                  <>
                    <span className="hidden lg:inline">/ focuses chat · </span>
                    Press Enter to ask · Shift+Enter for a new line.
                  </>
                )}
              </p>
              {usage && usage.used / Math.max(usage.limit, 1) >= 0.8 && (
                <p className="px-1 text-[10px] text-[var(--muted)]">
                  {Math.max(0, usage.limit - usage.used)} messages left today
                </p>
              )}
            </form>
          </div>
        </section>
        <div
          className={`${tab === "notes" ? "block" : "hidden"} min-h-0 overflow-y-auto overflow-x-hidden [overscroll-behavior-x:none] touch-pan-y lg:block`}
        >
          {activeCitation && (
            <button
              type="button"
              onClick={() => setTab("chat")}
              className="sticky top-2 z-20 mx-3 mt-2 h-8 rounded-full bg-[var(--purple)] px-3 text-[10px] text-white shadow-[0_6px_14px_rgba(66,47,39,0.18)] lg:hidden"
            >
              Back to chat
            </button>
          )}
          <SourceViewer
            collection={collection}
            citation={activeCitation}
            onHighlightAnchorChange={onSourceHighlightAnchorChange}
          />
        </div>
        <CitationThreadSvg
          workspaceRef={workspaceRef}
          fromElement={citationTrigger}
          toElement={sourceHighlightElement}
          label={(activeCitation?.orderIndex ?? 0) + 1}
          animationKey={citationAnimationKey}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {completedAnnouncement}
      </p>
      {mobileCitationPreview && (
        <div
          className="fixed inset-0 z-[90] flex items-end bg-[rgba(27,25,26,0.28)] lg:hidden"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close citation preview"
            onClick={() => setMobileCitationPreview(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Citation preview"
            className="relative w-full bg-[var(--cream)] p-5 shadow-[0_-18px_45px_rgba(27,25,26,0.2)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--purple)]">
              Cited evidence
              {mobileCitationPreview.pageNumber
                ? ` · page ${mobileCitationPreview.pageNumber}`
                : ""}
            </p>
            <p className="mt-3 font-[var(--serif)] text-[15px] leading-6 text-[var(--body)]">
              {mobileCitationPreview.highlightText ??
                mobileCitationPreview.content}
            </p>
            <button
              type="button"
              onClick={() => {
                setMobileCitationPreview(null);
                setTab("notes");
              }}
              className="mt-5 h-10 w-full rounded-md bg-[var(--purple)] text-[12px] text-white"
            >
              Open in notes
            </button>
          </section>
        </div>
      )}
      {isClearConfirmationOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center p-4"
          role="presentation"
        >
          <button
            type="button"
            onClick={() => !isClearing && setIsClearConfirmationOpen(false)}
            className="absolute inset-0 bg-[rgba(27,25,26,0.34)] backdrop-blur-[2px]"
            aria-label="Cancel clearing conversation"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-conversation-title"
            className="relative w-full max-w-sm bg-[var(--cream)] p-6 shadow-[0_28px_90px_rgba(38,26,42,0.26)]"
          >
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[#963e43]">
              Permanent action
            </p>
            <h2
              id="clear-conversation-title"
              className="mt-3 font-[var(--serif)] text-[19px] font-light tracking-[-0.045em] text-[var(--ink)]"
            >
              Clear this conversation?
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-[var(--body)]">
              This removes this chat’s messages and citation history. Your
              documents and collection stay untouched.
            </p>
            {clearError && (
              <p className="mt-3 text-[12px] text-[var(--signal)]" role="alert">
                {clearError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsClearConfirmationOpen(false)}
                disabled={isClearing}
                className="h-10 rounded-md px-3 text-[12px] font-medium text-[var(--body)] transition hover:bg-[var(--paper)] disabled:opacity-50"
              >
                Keep chat
              </button>
              <button
                type="button"
                onClick={() => void clearConversation()}
                disabled={isClearing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#963e43] px-4 text-[12px] font-medium text-white transition hover:-translate-y-px hover:bg-[#783034] disabled:cursor-wait disabled:opacity-70"
              >
                {isClearing ? (
                  <>
                    <Spinner className="size-3.5 animate-spin" /> Clearing…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} strokeWidth={1} /> Clear chat
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
