import { describe, expect, it } from "vitest";
import { toUploadFile } from "../../src/features/documents/uploadFile";

async function multipartType(file: File) {
  const form = new FormData();
  form.append("", file);
  return new Response(form).text();
}

describe("toUploadFile", () => {
  it("normalizes the MIME part for Markdown and plain text uploads", async () => {
    const iosMarkdown = new File(["# hi"], "notes.md", {
      type: "text/x-markdown",
    });
    const emptyMarkdown = new File(["# hi"], "notes.md", { type: "" });
    const emptyText = new File(["hello"], "notes.txt", { type: "" });

    await expect(multipartType(iosMarkdown)).resolves.toContain(
      "Content-Type: text/x-markdown",
    );
    await expect(multipartType(toUploadFile(iosMarkdown))).resolves.toContain(
      "Content-Type: text/markdown",
    );
    await expect(multipartType(toUploadFile(emptyMarkdown))).resolves.toContain(
      "Content-Type: text/markdown",
    );
    await expect(multipartType(toUploadFile(emptyText))).resolves.toContain(
      "Content-Type: text/plain",
    );
  });

  it("preserves PDFs as application/pdf", async () => {
    const pdf = new File(["%PDF"], "course.pdf", { type: "" });
    const body = await multipartType(toUploadFile(pdf));
    expect(body).toContain("Content-Type: application/pdf");
  });
});
