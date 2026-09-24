export type DocumentStatus = "pending" | "embedding" | "ready" | "failed";

export type CollectionDocument = {
  id: string;
  filename: string;
  storagePath: string;
  size: number;
  pageCount?: number;
  chunkCount?: number;
  embeddedChunkCount?: number;
  status: DocumentStatus;
  addedAt: string;
  content?: string;
};

export type Collection = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  openCount: number;
  documents: CollectionDocument[];
};

export type ChatCitation = {
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number | null;
  content: string;
  orderIndex: number;
  highlightText?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "not-found" | "rate-limited" | "provider-error";
  citations?: ChatCitation[];
};