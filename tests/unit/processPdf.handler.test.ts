// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mocks = vi.hoisted(() => ({
  clients: [] as unknown[],
  preloadPdfWorker: vi.fn(async () => undefined),
  hasSelectableText: vi.fn(async () => true),
  openPdf: vi.fn(),
  renderPage: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mocks.clients.shift()),
}));

vi.mock("../../api/_lib/pdfPages.js", () => ({
  preloadPdfWorker: mocks.preloadPdfWorker,
  hasSelectableText: mocks.hasSelectableText,
  openPdf: mocks.openPdf,
  renderPage: mocks.renderPage,
}));

import handler, { BATCH_MAX } from "../../api/process-pdf.js";

type Captured = { status: number; body: Record<string, unknown> };

function responseCapture() {
  const captured: Captured = { status: 200, body: {} };
  const response = {
    status(code: number) {
      captured.status = code;
      return response;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return response;
    },
  } as unknown as VercelResponse;
  return { captured, response };
}

function request(body: Record<string, unknown>, token = "test-token") {
  return {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  } as unknown as VercelRequest;
}

function scopedClient(document: unknown) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: document, error: null })),
        })),
      })),
    })),
  };
}

function adminClient() {
  const upload = vi.fn(async () => ({ error: null }));
  const upsert = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  return {
    storage: {
      from: vi.fn((bucket: string) =>
        bucket === "notes-documents"
          ? {
              download: vi.fn(async () => ({
                data: { arrayBuffer: async () => new ArrayBuffer(8) },
                error: null,
              })),
            }
          : { upload },
      ),
    },
    from: vi.fn((table: string) =>
      table === "document_pages" ? { upsert } : { update },
    ),
    upload,
    upsert,
  };
}

const document = {
  id: "document-1",
  storage_path: "user-1/collection/file.pdf",
  collection_id: "collection-1",
  page_count: null,
};

describe("process-pdf handler", () => {
  beforeEach(() => {
    mocks.clients.length = 0;
    mocks.preloadPdfWorker.mockClear();
    mocks.hasSelectableText.mockReset();
    mocks.hasSelectableText.mockResolvedValue(true);
    mocks.openPdf.mockReset();
    mocks.renderPage.mockReset();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.MAX_PDF_PAGES = "300";
  });

  it("returns 401 without a bearer token", async () => {
    const { captured, response } = responseCapture();
    await handler(
      request({ documentId: "document-1", fromPage: 1, toPage: 1 }, ""),
      response,
    );
    expect(captured).toMatchObject({
      status: 401,
      body: { code: "UNAUTHORIZED" },
    });
  });

  it("returns 404 when RLS does not expose another user's document", async () => {
    const invisibleScopedClient = scopedClient(null);
    (invisibleScopedClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    });
    mocks.clients.push(invisibleScopedClient);
    const { captured, response } = responseCapture();
    await handler(
      request({ documentId: "other-user-document", fromPage: 1, toPage: 1 }),
      response,
    );
    expect(captured).toMatchObject({
      status: 404,
      body: { code: "NOT_FOUND" },
    });
  });

  it("returns 422 before rendering when the PDF exceeds the configured limit", async () => {
    process.env.MAX_PDF_PAGES = "2";
    mocks.clients.push(scopedClient(document), adminClient());
    mocks.openPdf.mockResolvedValue({ numPages: 3 });
    const { captured, response } = responseCapture();
    await handler(
      request({ documentId: document.id, fromPage: 1, toPage: 1 }),
      response,
    );
    expect(captured).toMatchObject({
      status: 422,
      body: { code: "TOO_MANY_PAGES" },
    });
    expect(mocks.renderPage).not.toHaveBeenCalled();
  });

  it("rejects image-only PDFs before rendering", async () => {
    mocks.clients.push(scopedClient(document), adminClient());
    mocks.openPdf.mockResolvedValue({ numPages: 1 });
    mocks.hasSelectableText.mockResolvedValue(false);
    const { captured, response } = responseCapture();
    await handler(
      request({ documentId: document.id, fromPage: 1, toPage: 1 }),
      response,
    );
    expect(captured).toMatchObject({
      status: 422,
      body: { code: "NO_SELECTABLE_TEXT" },
    });
    expect(mocks.renderPage).not.toHaveBeenCalled();
  });

  it("writes page rows and returns extracted text on success", async () => {
    const admin = adminClient();
    mocks.clients.push(scopedClient(document), admin);
    mocks.openPdf.mockResolvedValue({ numPages: 1 });
    mocks.renderPage.mockResolvedValue({
      pageNumber: 1,
      jpeg: Buffer.from("jpeg"),
      width: 612,
      height: 792,
      words: [["Known", 0.1, 0.1, 0.1, 0.03]],
      text: "Known evidence",
    });
    const { captured, response } = responseCapture();
    await handler(
      request({ documentId: document.id, fromPage: 1, toPage: 1 }),
      response,
    );
    expect(captured).toEqual({
      status: 200,
      body: {
        pageCount: 1,
        pages: [{ pageNumber: 1, text: "Known evidence" }],
      },
    });
    expect(admin.upload).toHaveBeenCalledTimes(1);
    expect(admin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ document_id: document.id, page_number: 1 }),
      { onConflict: "document_id,page_number" },
    );
  });

  it("omits extracted text for render-only backfills", async () => {
    const admin = adminClient();
    mocks.clients.push(scopedClient(document), admin);
    mocks.openPdf.mockResolvedValue({ numPages: 1 });
    mocks.renderPage.mockResolvedValue({
      pageNumber: 1,
      jpeg: Buffer.from("jpeg"),
      width: 612,
      height: 792,
      words: [],
      text: "Known evidence",
    });
    const { captured, response } = responseCapture();
    await handler(
      request({
        documentId: document.id,
        fromPage: 1,
        toPage: 1,
        renderOnly: true,
      }),
      response,
    );
    expect(captured).toEqual({ status: 200, body: { pageCount: 1 } });
  });

  it("rejects ranges over the batch maximum", async () => {
    const { captured, response } = responseCapture();
    await handler(
      request({ documentId: document.id, fromPage: 1, toPage: BATCH_MAX + 1 }),
      response,
    );
    expect(captured).toMatchObject({
      status: 400,
      body: { code: "INVALID_REQUEST" },
    });
  });
});
