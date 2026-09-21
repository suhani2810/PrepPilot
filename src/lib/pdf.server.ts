// Server-only PDF text extraction using unpdf (worker/edge safe).
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  return (await extractPdfPages(bytes)).map((page) => page.text).join("\n\n");
}

export type ExtractedPdfPage = { page: number; text: string };

/** Extract page-aware text so generated material can retain verifiable citations. */
export async function extractPdfPages(bytes: Uint8Array): Promise<ExtractedPdfPage[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: false });
  const raw = text as unknown;
  const pages = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return pages
    .map((pageText, index) => ({ page: index + 1, text: String(pageText ?? "").trim() }))
    .filter((page) => page.text.length > 0);
}
