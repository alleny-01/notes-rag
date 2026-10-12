export function resolveContentType(file: File) {
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".md")) return "text/markdown";
  if (filename.endsWith(".txt")) return "text/plain";
  if (filename.endsWith(".pdf")) return "application/pdf";
  return file.type || "application/octet-stream";
}

/** Ensures Storage multipart uploads use a stable MIME type on every browser. */
export function toUploadFile(file: File) {
  return new File([file], file.name, {
    type: resolveContentType(file),
    lastModified: file.lastModified,
  });
}
