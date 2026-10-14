import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";
import { parseRosterCsv } from "@/lib/players";

const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/players/import/parse multipart { file } -> { rows, existingCount }
// (team page import modal). CSV is parsed server-side; .xlsx/.xls/.pdf are
// accepted by the client picker but the clone only reads CSV, so they answer
// with the client's own PARSE_FAILED / PDF_UNREADABLE error codes.
async function handlePOST(req: Request) {
  let file: File | null = null;
  try {
    const value = (await req.formData()).get("file");
    file = value instanceof File ? value : null;
  } catch {
    file = null;
  }
  if (!file) return json({ error: "missing file", code: "MISSING_FILE" }, { status: 400 });
  if (file.size === 0) return json({ error: "empty file", code: "EMPTY_FILE" }, { status: 400 });
  if (file.size > MAX_BYTES) return json({ error: "file too large", code: "FILE_TOO_LARGE" }, { status: 400 });

  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return json({ error: "pdf not supported", code: "PDF_UNREADABLE" }, { status: 422 });
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return json({ error: "export the sheet as CSV", code: "PARSE_FAILED" }, { status: 422 });
  }
  if (!name.endsWith(".csv")) return json({ error: "unsupported format", code: "UNSUPPORTED_FORMAT" }, { status: 400 });

  const rows = parseRosterCsv(await file.text());
  if (!rows.length) return json({ error: "no players found", code: "NO_PLAYERS_FOUND" }, { status: 422 });
  return json({ rows, existingCount: store.players.length });
}

export const POST = withStore(handlePOST);
