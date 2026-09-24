# NotesRAG

NotesRAG is a source-grounded study workspace for your course notes. Upload a text-based PDF, Markdown file, or plain-text note; ask a question; and inspect the exact cited source passage before trusting an answer.

## What it does

- Organises documents into private study collections.
- Extracts page-aware text in the browser for PDFs, then chunks and embeds it with Voyage AI.
- Retrieves only passages from the current collection before generating a DeepSeek Flash answer.
- Stores the actual retrieved chunk IDs as citations instead of trusting free-form model citation claims.
- Opens the cited PDF/TXT/Markdown source and highlights the claim used in the answer. Desktop workspaces animate a live connector from citation to source.
- Supports concise study questions, multi-part questions, and multiple-choice prompts with supplied options.
- Enforces a per-user daily message cap before retrieval or model generation.

## Supported uploads

| Format | Support | Notes |
| --- | --- | --- |
| `.pdf` | Yes | Must have selectable text. Scanned/image-only PDFs are intentionally rejected. |
| `.txt` | Yes | Plain text. |
| `.md` | Yes | Markdown is stored and read as text. |

Uploads are limited to 20 MB per file in this MVP.

## Architecture

```text
Browser
  ├─ extracts text/page data from PDFs with pdfjs-dist
  ├─ stores the raw source in Supabase Storage
  └─ calls Supabase Edge Functions
       ├─ ingest-document → chunk → Voyage embeddings → pgvector
       ├─ retrieve-chunks → similarity search for manual validation
       └─ chat → daily-cap check → Voyage retrieval → streamed DeepSeek answer

Supabase
  ├─ Google Auth + RLS-protected Postgres
  ├─ Storage bucket: notes-documents
  └─ pgvector chunks, chat sessions, messages, citation join rows
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the public browser values:

   ```ini
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   ```

   Never put the Voyage or DeepSeek secret in this file; browser environment values are public after a Vite build.

3. Apply the SQL migrations in `supabase/migrations` using the Supabase SQL editor or CLI.

4. Set Edge Function secrets in Supabase:

   ```bash
   npx supabase secrets set VOYAGE_API_KEY=... DEEPSEEK_API_KEY=... DAILY_MESSAGE_LIMIT=50 --project-ref YOUR_PROJECT_REF
   ```

5. Deploy the functions after a change:

   ```bash
   npx supabase functions deploy ingest-document --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy retrieve-chunks --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy chat --project-ref YOUR_PROJECT_REF
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

Before release, complete this manual flow on both desktop and mobile:

1. Create a collection and upload a text-based PDF, `.txt`, and `.md` note.
2. Confirm every document reaches **Ready to chat**.
3. Ask a known-answer question and a deliberately unsupported question.
4. Confirm the known answer contains citations; click each citation and verify the exact source claim is highlighted.
5. Verify Markdown/TXT sources scroll to their highlighted claim and PDFs open their cited page.
6. Ask one option-based question with choices, and confirm the selected option is source-grounded.
7. Confirm the daily limit returns the dedicated limit state and does not call the model.
8. Check 375px, 768px, 1024px, 1280px, and 1440px widths for no horizontal overflow.

## Decisions and trade-offs

- **Retrieval is truth.** The generator receives only retrieved passages. If retrieval does not meet the similarity threshold, NotesRAG returns a deliberate “not found in your notes” state instead of asking the model to guess.
- **Citation integrity is server-owned.** `citations` records the retrieved chunk IDs and passage order. The UI maps model `[n]` markers onto those stored chunks; it does not infer citations from arbitrary prose.
- **No OCR in the MVP.** Client extraction avoids a server PDF runtime, but image-only PDFs do not provide reliable text and are excluded until OCR can be supported honestly.
- **Daily cap before cost.** `usage_daily` increments before retrieval and DeepSeek, preventing one account from driving uncapped model spend. The documented extension point is a future application-wide cap.
- **Streaming with persistence.** Tokens stream to the UI for responsiveness. Once the full answer is complete, the answer and its citation join rows are stored together for reliable reloads.

## Deployment checklist

- Run the verification commands above.
- Confirm Supabase migrations are applied in order.
- Confirm `notes-documents` Storage policies and RLS policies are enabled.
- Set `VOYAGE_API_KEY`, `DEEPSEEK_API_KEY`, and `DAILY_MESSAGE_LIMIT` only as Supabase Edge Function secrets.
- Deploy all three Edge Functions after their code changes.
- Configure Google OAuth redirect URLs in both Google Cloud and Supabase Auth before enabling Google sign-in in production.