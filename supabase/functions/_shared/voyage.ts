/// <reference path="./deno-runtime.d.ts" />
const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5";
const OUTPUT_DIMENSION = 1024;

type VoyageInputType = "document" | "query";
type VoyageResponse = {
  data?: Array<{ embedding: number[]; index: number }>;
  detail?: string;
  message?: string;
};

async function embed(input: string[], inputType: VoyageInputType) {
  const apiKey = Deno.env.get("VOYAGE_API_KEY");
  if (!apiKey)
    throw new Error("VOYAGE_API_KEY is not configured for this Edge Function.");

  const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      model: MODEL,
      input_type: inputType,
      output_dimension: OUTPUT_DIMENSION,
      output_dtype: "float",
      truncation: false,
    }),
  });

  const result = (await response.json()) as VoyageResponse;
  if (!response.ok || !result.data) {
    throw new Error(
      result.detail ?? result.message ?? "Voyage could not create embeddings.",
    );
  }

  const ordered = [...result.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
  if (
    ordered.length !== input.length ||
    ordered.some((vector) => vector.length !== OUTPUT_DIMENSION)
  ) {
    throw new Error("Voyage returned an unexpected embedding response.");
  }
  return ordered;
}

export function embedDocuments(input: string[]) {
  return embed(input, "document");
}

export async function embedQuery(question: string) {
  return (await embed([question], "query"))[0];
}
