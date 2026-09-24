import type { ReactNode } from "react";
import type { ChatCitation } from "../../collections/types/domain";

type InlineCitationAnswerProps = {
  content: string;
  citations?: ChatCitation[];
  onOpenCitation: (citation: ChatCitation, trigger?: HTMLElement) => void;
};

function cleanClaim(value: string) {
  return value
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–—•]\s*/, "");
}

function claimBeforeCitation(content: string, position: number) {
  const before = content.slice(0, position).replace(/\[\d+\]\s*$/g, "").trim();
  const boundary = Math.max(
    before.lastIndexOf("."),
    before.lastIndexOf("?"),
    before.lastIndexOf("!"),
    before.lastIndexOf("\n"),
  );
  return cleanClaim(before.slice(boundary + 1));
}

/**
 * A marker belongs to the exact claim immediately before it, not to every
 * sentence in the retrieved chunk. Position is part of the identity: repeated
 * [1] markers in one answer can therefore point at different claims.
 */
export function citationTargetForMarker(
  content: string,
  citations: ChatCitation[],
  position: number,
  passageNumber: number,
) {
  const citation = citations.find((candidate) => candidate.orderIndex + 1 === passageNumber);
  const claim = claimBeforeCitation(content, position);
  return citation && claim.length >= 8
    ? { ...citation, highlightText: claim }
    : undefined;
}

function firstCitationTargetForPassage(content: string, citations: ChatCitation[], passageNumber: number) {
  for (const marker of content.matchAll(/\[(\d+)\]/g)) {
    if (Number(marker[1]) !== passageNumber) continue;
    return citationTargetForMarker(content, citations, marker.index ?? 0, passageNumber);
  }
  return undefined;
}

export function citationTargetsForAnswer(content: string, citations: ChatCitation[]) {
  return new Map(
    citations.map((citation) => [
      citation.orderIndex + 1,
      firstCitationTargetForPassage(content, citations, citation.orderIndex + 1) ?? citation,
    ]),
  );
}
export function InlineCitationAnswer({
  content,
  citations = [],
  onOpenCitation,
}: InlineCitationAnswerProps) {

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(/\[(\d+)\]/g)) {
    const position = match.index ?? 0;
    if (position > cursor) parts.push(content.slice(cursor, position));
    const passageNumber = Number(match[1]);
    const citation = citationTargetForMarker(content, citations, position, passageNumber);

    parts.push(
      citation ? (
        <button
          key={`${position}-${passageNumber}`}
          type="button"
          onClick={(event) => onOpenCitation(citation, event.currentTarget)}
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