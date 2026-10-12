### NotesRAG

[![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?logo=vercel&logoColor=white)](https://vercel.com/)

> <sub>A source-grounded study workspace that lets students ask questions about their own notes and inspect the exact passage behind every answer.</sub>

<sub>NotesRAG is designed around one principle: <strong>retrieval decides what is true; generation only phrases it.</strong> Upload a text-based PDF, Markdown file, or plain-text note, then study with answers that remain traceable to the original material.</sub>

#### Highlights

| Capability                                        | What it means                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| <sub><strong>Private collections</strong></sub>   | <sub>Keep course materials, revision packs, and project notes organised by topic.</sub>                                      |
| <sub><strong>Grounded answers</strong></sub>      | <sub>Answers are generated only from retrieved passages in the active collection.</sub>                                      |
| <sub><strong>Claim-level citations</strong></sub> | <sub>Citation chips open the source and highlight the exact matching words, not just an entire chunk.</sub>                  |
| <sub><strong>Honest gaps</strong></sub>           | <sub>When the material does not support an answer, NotesRAG clearly says so without calling the language model.</sub>        |
| <sub><strong>Built for study flow</strong></sub>  | <sub>Ask follow-up questions, use starter prompts, solve option-based questions, and clear chats when beginning again.</sub> |
| <sub><strong>Responsive workspace</strong></sub>  | <sub>Chat and source material sit side-by-side on desktop; mobile uses focused, touch-friendly views.</sub>                  |

#### Supported sources

| Format                | Status       | Notes                                                                                                |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| <sub>PDF</sub>        | <sub>✓</sub> | <sub>Text-based PDFs with selectable text. Scanned/image-only PDFs are intentionally rejected.</sub> |
| <sub>Markdown</sub>   | <sub>✓</sub> | <sub>`.md` files are indexed as source text.</sub>                                                   |
| <sub>Plain text</sub> | <sub>✓</sub> | <sub>`.txt` notes are indexed as source text.</sub>                                                  |

<sub>Files are limited to 20 MB in the MVP.</sub>

#### How it works

```mermaid
flowchart LR
  A[Upload source] --> B[Secure storage]
  B --> C[Extract & chunk]
  C --> D[Voyage embeddings]
  D --> E[(Supabase pgvector)]
  Q[Ask a question] --> R[Retrieve relevant passages]
  E --> R
  R --> G[DeepSeek generation]
  G --> H[Answer + verified citations]
  H --> I[Highlighted source passage]
```

<sub>PDFs are prepared in a Vercel Node function and rendered as page images with normalized word positions. This keeps PDF.js and native canvas work off the browser, avoiding WebKit compatibility failures while retaining precise source highlights.</sub>

#### Product architecture

| Layer                                   | Responsibilities                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| <sub><strong>Web app</strong></sub>     | <sub>React, TypeScript, Vite, TanStack Query, responsive workspace UI, animations, and client-side session state.</sub> |
| <sub><strong>Supabase</strong></sub>    | <sub>Authentication, PostgreSQL with pgvector, Row Level Security, Storage, Realtime, and Edge Functions.</sub>         |
| <sub><strong>Vercel</strong></sub>      | <sub>Production frontend hosting and authenticated PDF preparation at <code>/api/process-pdf</code>.</sub>              |
| <sub><strong>AI services</strong></sub> | <sub>Voyage for embeddings and DeepSeek for answer generation.</sub>                                                    |

#### Trust and safety by design

- <sub><strong>Citation integrity is server-owned.</strong> Retrieved chunk IDs are persisted in the <code>citations</code> join table; the UI never trusts free-form citation claims from a model.</sub>
- <sub><strong>Retrieval comes before generation.</strong> Below-threshold retrieval returns the dedicated “not found in your notes” state and skips the model request.</sub>
- <sub><strong>RLS protects user data.</strong> Collections, sources, chats, settings, and feedback are scoped to the authenticated user.</sub>
- <sub><strong>Cost controls run first.</strong> A per-user daily message cap is checked before retrieval or model generation.</sub>
- <sub><strong>Secrets stay server-side.</strong> Voyage and DeepSeek keys live only in Supabase Edge Function secrets. Vercel service credentials are used only by its serverless PDF function.</sub>

#### Technical notes

- <sub>No OCR is included in the MVP. A PDF must have a selectable text layer to be indexed reliably.</sub>
- <sub>Source highlights resolve against the original words and their coordinates, enabling accurate PDF and text navigation.</sub>
- <sub>The PDF duplicate check uses file bytes; Markdown and text use normalized-content hashing.</sub>
- <sub>Edge Functions handle ingestion, retrieval validation, chat, usage metering, and account deletion.</sub>

#### Development

```bash
npm install
npm run dev
```

<sub>Copy <a href=".env.example"><code>.env.example</code></a> to <code>.env</code> and provide only the public browser values:</sub>

```ini
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

<sub>For a complete local PDF-processing environment, use <code>npx vercel dev</code> with the server-only values documented in <code>.env.example</code>. Never commit secrets or use a <code>VITE_</code> prefix for server credentials.</sub>

#### Quality checks

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

#### Deployment

1. <sub>Apply pending Supabase migrations with <code>npx supabase db push</code> after checking the migration plan.</sub>
2. <sub>Deploy the Supabase functions: <code>ingest-document</code>, <code>retrieve-chunks</code>, <code>chat</code>, <code>get-usage</code>, and <code>delete-account</code>.</sub>
3. <sub>Configure the Vercel environment variables listed in <code>.env.example</code>, including the server-only Supabase values used by PDF processing.</sub>
4. <sub>Configure Supabase Auth with the production site URL and allowed Vercel redirect URLs for magic-link and Google sign-in.</sub>
5. <sub>Push <code>main</code> to create the production Vercel deployment.</sub>

#### License

<sub>This project is currently private and unlicensed.</sub>
