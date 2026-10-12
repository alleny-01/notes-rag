import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  hasSelectableText,
  openPdf,
  preloadPdfWorker,
  renderPage,
} from "./_lib/pdfPages.js";

type ProcessRequest = {
  documentId?: unknown;
  fromPage?: unknown;
  toPage?: unknown;
  renderOnly?: unknown;
};
type DocumentRecord = {
  id: string;
  storage_path: string;
  collection_id: string;
  page_count: number | null;
};

export const BATCH_MAX = 15;

function json(
  response: VercelResponse,
  status: number,
  body: Record<string, unknown>,
) {
  return response.status(status).json(body);
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

export function maxPdfPages() {
  return Math.max(
    1,
    Number.parseInt(process.env.MAX_PDF_PAGES ?? "300", 10) || 300,
  );
}

function readBody(request: VercelRequest): ProcessRequest | null {
  if (request.body && typeof request.body === "object")
    return request.body as ProcessRequest;
  if (typeof request.body !== "string") return null;
  try {
    return JSON.parse(request.body) as ProcessRequest;
  } catch {
    return null;
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST")
    return json(response, 405, { error: "Method not allowed." });
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.authorization;
  if (!supabaseUrl || !anonKey || !serviceRoleKey)
    return json(response, 500, {
      error: "PDF processing is not configured.",
      code: "CONFIGURATION",
    });
  if (!authorization?.startsWith("Bearer "))
    return json(response, 401, {
      error: "Unauthorized.",
      code: "UNAUTHORIZED",
    });

  const payload = readBody(request);
  const documentId =
    typeof payload?.documentId === "string" ? payload.documentId : "";
  const fromPage = integer(payload?.fromPage);
  const toPage = integer(payload?.toPage);
  const renderOnly = payload?.renderOnly === true;
  if (
    !documentId ||
    fromPage < 1 ||
    toPage < fromPage ||
    toPage - fromPage + 1 > BATCH_MAX
  ) {
    return json(response, 400, {
      error: `Provide a document id and a page range of at most ${BATCH_MAX} pages.`,
      code: "INVALID_REQUEST",
    });
  }

  const scoped = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth, error: authError } = await scoped.auth.getUser();
  if (authError || !auth.user)
    return json(response, 401, {
      error: "Unauthorized.",
      code: "UNAUTHORIZED",
    });
  const { data: document, error: documentError } = await scoped
    .from("documents")
    .select("id, storage_path, collection_id, page_count")
    .eq("id", documentId)
    .maybeSingle<DocumentRecord>();
  if (documentError || !document)
    return json(response, 404, {
      error: "Document not found.",
      code: "NOT_FOUND",
    });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  try {
    await preloadPdfWorker();
    const { data: source, error: downloadError } = await admin.storage
      .from("notes-documents")
      .download(document.storage_path);
    if (downloadError || !source)
      throw new Error(
        downloadError?.message ?? "The PDF source could not be downloaded.",
      );
    const pdf = await openPdf(new Uint8Array(await source.arrayBuffer()));
    const pageCount = pdf.numPages;
    const maxPages = maxPdfPages();
    if (pageCount > maxPages)
      return json(response, 422, {
        error: `This PDF has ${pageCount} pages. The limit is ${maxPages}.`,
        code: "TOO_MANY_PAGES",
      });
    if (fromPage === 1 && !(await hasSelectableText(pdf))) {
      return json(response, 422, {
        error:
          "This PDF has no selectable text. NotesRAG currently supports text-based PDFs only.",
        code: "NO_SELECTABLE_TEXT",
      });
    }
    if (fromPage > pageCount)
      return json(response, 400, {
        error: "The requested page range is outside this PDF.",
        code: "INVALID_REQUEST",
      });
    const start = Math.min(fromPage, pageCount);
    const end = Math.min(toPage, pageCount);
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      const rendered = await renderPage(pdf, pageNumber);
      const imagePath = `${auth.user.id}/${document.id}/${pageNumber}.jpg`;
      const { error: uploadError } = await admin.storage
        .from("notes-pages")
        .upload(imagePath, rendered.jpeg, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "3600",
        });
      if (uploadError) throw new Error(uploadError.message);
      const { error: pageError } = await admin.from("document_pages").upsert(
        {
          document_id: document.id,
          page_number: pageNumber,
          image_path: imagePath,
          image_width: rendered.width,
          image_height: rendered.height,
          words: rendered.words,
        },
        { onConflict: "document_id,page_number" },
      );
      if (pageError) throw new Error(pageError.message);
      if (rendered.text) pages.push({ pageNumber, text: rendered.text });
    }
    const { error: updateError } = await admin
      .from("documents")
      .update({ page_count: pageCount })
      .eq("id", document.id);
    if (updateError) throw new Error(updateError.message);
    return json(
      response,
      200,
      renderOnly ? { pageCount } : { pageCount, pages },
    );
  } catch (error) {
    console.error("process-pdf failed", error);
    return json(response, 500, {
      error: "We could not prepare this PDF. Please try again.",
      code: "PROCESSING_FAILED",
    });
  }
}
