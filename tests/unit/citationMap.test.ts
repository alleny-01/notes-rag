import { describe, expect, it } from "vitest";
import { citationTargetForMarker, citationTargetsForAnswer } from "../../src/features/chat/citationMap";

const citations = [
  { chunkId: "chunk-one", documentId: "doc", filename: "notes.md", pageNumber: 1, content: "", orderIndex: 0 },
  { chunkId: "chunk-two", documentId: "doc", filename: "notes.md", pageNumber: 2, content: "", orderIndex: 1 },
];

describe("citation mapping", () => {
  it("binds a marker to the exact preceding claim and its true chunk", () => {
    const answer = "A software engineer designs and maintains software systems [1].";
    const target = citationTargetForMarker(answer, citations, answer.indexOf("[1]"), 1);

    expect(target).toMatchObject({ chunkId: "chunk-one", orderIndex: 0 });
    expect(target?.highlightText).toBe("A software engineer designs and maintains software systems");
  });

  it("keeps repeated markers distinct by their source claim position", () => {
    const answer = "Designs systems [1]. Tests releases [1].";
    const first = citationTargetForMarker(answer, citations, answer.indexOf("[1]"), 1);
    const second = citationTargetForMarker(answer, citations, answer.lastIndexOf("[1]"), 1);

    expect(first?.highlightText).toBe("Designs systems");
    expect(second?.highlightText).toBe("Tests releases");
    expect(first?.chunkId).toBe(second?.chunkId);
  });

  it("does not bind a model-invented marker to a chunk", () => {
    const answer = "Unsupported claim [9].";
    expect(citationTargetForMarker(answer, citations, answer.indexOf("[9]"), 9)).toBeUndefined();
  });

  it("maps each retrieved passage number to the first matching inline claim", () => {
    const answer = "Builds software [1]. Reviews quality [2].";
    const targets = citationTargetsForAnswer(answer, citations);

    expect(targets.get(1)).toMatchObject({ chunkId: "chunk-one", highlightText: "Builds software" });
    expect(targets.get(2)).toMatchObject({ chunkId: "chunk-two", highlightText: "Reviews quality" });
  });
});