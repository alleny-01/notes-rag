/// <reference path="./deno-runtime.d.ts" />

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-flash";

function retryAfterMilliseconds(value: string | null) {
  if (!value) return 2_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 2_000 : Math.max(0, date - Date.now());
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/** Opens one DeepSeek SSE stream. A provider 429 is retried exactly once. */
export async function openGroundedAnswerStream(system: string, question: string) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured for this Edge Function.");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.1,
        max_tokens: 900,
        thinking: { type: "disabled" },
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
      }),
    });

    if (response.status === 429 && attempt === 0) {
      await wait(retryAfterMilliseconds(response.headers.get("Retry-After")));
      continue;
    }
    if (!response.ok) throw new Error(`DeepSeek request failed with status ${response.status}.`);
    if (!response.body) throw new Error("DeepSeek returned an empty response stream.");
    return response;
  }

  throw new Error("DeepSeek remained rate limited after one retry.");
}