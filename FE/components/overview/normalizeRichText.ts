export function normalizeRichText(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) {
    return "";
  }

  // Heuristic: if it looks like HTML, normalize line breaks and strip tags.
  const looksLikeHtml = /<\s*\/?\s*[a-z][\s\S]*>/i.test(raw);
  if (!looksLikeHtml) {
    return raw
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  let text = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*div[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  // Decode entities in-browser.
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(text, "text/html");
      text = (doc.documentElement.textContent ?? "").toString();
    } catch {
      // ignore
    }
  }

  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

