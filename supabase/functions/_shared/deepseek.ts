/// <reference path="./deno-runtime.d.ts" />

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-flash";

type DeepSeekPayload = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

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

/** Calls DeepSeek at most twice: the second request is only for a provider 429. */
export async function generateGroundedAnswer(system: string, question: string) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured for this Edge Function.");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.1,
        max_tokens: 900,
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

    const result = (await response.json()) as DeepSeekPayload;
    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("DeepSeek returned an empty answer.");
    return content;
  }

  throw new Error("DeepSeek remained rate limited after one retry.");
}