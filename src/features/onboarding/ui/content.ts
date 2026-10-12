import type { Citation, FeaturePanel } from "../types/onboarding";

export const citations: Citation[] = [
  {
    id: 1,
    page: "p. 14",
    title: "Balancing a binary search tree",
    text: "A red-black tree is a binary search tree in which every node carries a color bit. The color constraints ensure that no root-to-leaf path is more than twice as long as any other.",
  },
  {
    id: 2,
    page: "p. 16",
    title: "Why the constraints matter",
    text: "By constraining the longest path to be no more than double the shortest, insertion, search, and deletion remain logarithmic in the number of nodes.",
  },
  {
    id: 3,
    page: "p. 31",
    title: "When the notes are silent",
    text: "The material does not cover implementations that use a parent pointer. Mark this as an open question rather than infer an answer from adjacent concepts.",
  },
];

export const featurePanels: FeaturePanel[] = [
  {
    number: "01",
    title: "Bring the material you already trust.",
    text: "Text PDFs and plain notes become a private, searchable study space. Nothing asks you to start from zero.",
    tone: "panel-paper",
  },
  {
    number: "02",
    title: "Ask a precise question.",
    text: "Retrieval happens before language generation. A close-looking passage is not enough; relevance has to clear the bar.",
    tone: "panel-ink",
  },
  {
    number: "03",
    title: "See where every answer came from.",
    text: "Every answer carries a source path. Tap a citation and the original passage becomes the center of the conversation.",
    tone: "panel-violet",
  },
];
