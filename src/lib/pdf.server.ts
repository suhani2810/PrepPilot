// Server-only PDF text extraction using unpdf (worker/edge safe).
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  return typeof text === "string" ? text : Array.isArray(text) ? text.join("\n\n") : "";
}
