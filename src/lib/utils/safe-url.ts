/**
 * Defense against javascript:, data:, vbscript:, and file: URI XSS in links
 * whose href comes from user-controlled data (e.g. scraped practice.website).
 *
 * Returns the URL if it has an allowed protocol, otherwise "#".
 * Relative URLs (starting with /) and bare domains (no scheme) are allowed:
 * bare domains get https:// prepended so "example.com" still works as a link.
 */
const ALLOWED_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

export function safeExternalUrl(raw: string | null | undefined): string {
  if (!raw) return "#";
  const trimmed = raw.trim();
  if (trimmed === "") return "#";

  // Relative URLs are always safe.
  if (trimmed.startsWith("/")) return trimmed;

  // Detect scheme.
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase() + ":";
    if (ALLOWED_PROTOCOLS.has(scheme)) return trimmed;
    return "#";
  }

  // No scheme. Treat as a bare domain / path and force https://.
  return `https://${trimmed}`;
}
