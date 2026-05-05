// Ticket comments are stored as a threaded log inside the existing
// `resolution` free-text column (schema change is off-limits). Each entry
// takes the form "[ISO timestamp | author | kind] body" separated by a
// delimiter line. This keeps the DB schema untouched while giving the UI a
// real conversation view plus a final resolution when the ticket closes.

export const COMMENT_DELIM = "\n---\n";

export type Comment = {
  at: string;          // ISO timestamp
  author: string;
  kind: "comment" | "resolution";
  body: string;
};

export function parseComments(resolution: string | null | undefined): Comment[] {
  if (!resolution) return [];
  return resolution
    .split(COMMENT_DELIM)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      // Pattern: [iso | author | kind] body
      const m = chunk.match(/^\[([^|\]]+)\|([^|\]]+)\|([^\]]+)\]\s*([\s\S]*)$/);
      if (m) {
        return {
          at: m[1].trim(),
          author: m[2].trim(),
          kind: (m[3].trim() === "resolution" ? "resolution" : "comment") as Comment["kind"],
          body: m[4].trim(),
        };
      }
      // Legacy plain text — treat the whole blob as a single resolution entry.
      return { at: "", author: "Unknown", kind: "resolution" as const, body: chunk };
    });
}

export function appendComment(
  resolution: string | null | undefined,
  author: string,
  body: string,
  kind: Comment["kind"] = "comment"
): string {
  const entry = `[${new Date().toISOString()} | ${author} | ${kind}] ${body}`;
  return resolution && resolution.trim() ? `${resolution}${COMMENT_DELIM}${entry}` : entry;
}
