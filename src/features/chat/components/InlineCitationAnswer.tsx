import type { ReactNode } from "react";
import type { ChatCitation } from "../../collections/types/domain";

type InlineCitationAnswerProps = {
  content: string;
  citations?: ChatCitation[];
  onOpenCitation: (citation: ChatCitation) => void;
};

export function InlineCitationAnswer({
  content,
  citations = [],
  onOpenCitation,
}: InlineCitationAnswerProps) {
  const citationByPassage = new Map(
    citations.map((citation) => [citation.orderIndex + 1, citation]),
  );
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(/\[(\d+)\]/g)) {
    const position = match.index ?? 0;
    if (position > cursor) parts.push(content.slice(cursor, position));
    const passageNumber = Number(match[1]);
    const citation = citationByPassage.get(passageNumber);
    parts.push(
      citation ? (
        <button
          key={`${position}-${passageNumber}`}
          type="button"
          onClick={() => onOpenCitation(citation)}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-[var(--lilac)] px-1 align-baseline text-[10px] font-semibold text-[var(--purple)] transition hover:-translate-y-px hover:bg-[var(--purple)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:ring-offset-2"
          aria-label={`Open citation ${passageNumber}: ${citation.filename}${citation.pageNumber ? `, page ${citation.pageNumber}` : ""}`}
        >
          {match[0]}
        </button>
      ) : (
        <span key={`${position}-${passageNumber}`}>{match[0]}</span>
      ),
    );
    cursor = position + match[0].length;
  }

  if (cursor < content.length) parts.push(content.slice(cursor));
  return <>{parts}</>;
}
