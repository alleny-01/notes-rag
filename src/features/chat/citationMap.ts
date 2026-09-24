import type { ChatCitation } from "../collections/types/domain";

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
 * Binds an inline [n] marker to its actual retrieved chunk and the claim
 * immediately before that marker. Position matters: repeated [n] markers can
 * therefore highlight different claims from the same source chunk.
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