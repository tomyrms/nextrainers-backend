// Player factory + roster import helpers (contract §4, /api/players/import*).
import type { Player } from "./seed";

export const POSITIONS = ["GK", "DC", "DG", "DD", "MC", "MG", "MD", "MDC", "MOC", "BU", "AG", "AD"] as const;

let sequence = 0;

// A contract-shaped player; fields not provided fall back to demo defaults.
export function newPlayer(body: Partial<Player> | null | undefined): Player {
  return {
    id: `pl_${Date.now()}${sequence++ ? `_${sequence}` : ""}`,
    firstName: body?.firstName ?? "Nouveau",
    lastName: body?.lastName ?? "Joueur",
    nickname: null,
    position: body?.position ?? "MC",
    jerseyNumber: body?.jerseyNumber ?? 0,
    preferredFoot: body?.preferredFoot ?? "RIGHT",
    dateOfBirth: body?.dateOfBirth ?? "2011-01-01",
    coachNotes: body?.coachNotes ?? "",
    matches: body?.matches ?? 0,
    goals: body?.goals ?? 0,
    assists: body?.assists ?? 0,
    skills: body?.skills ?? [],
    playerSkills: body?.playerSkills ?? [],
    assistantSkills: body?.assistantSkills ?? [],
    assistantSkillOverlays: body?.assistantSkillOverlays ?? [],
    strengths: body?.strengths ?? [],
    improvements: body?.improvements ?? [],
    teamContext: { mode: "coach" },
  };
}

// ---------------------------------------------------------------- CSV import

export type ImportRow = {
  rowId: string;
  firstName: string;
  lastName: string;
  position: string; // "" when unknown, the client asks the coach to fill it
  jerseyNumber: number | null;
  preferredFoot: "RIGHT" | "LEFT";
  dateOfBirth: string | null;
};

const strip = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Normalized header -> field. French and English variants.
const HEADER_ALIASES: Record<string, keyof Omit<ImportRow, "rowId"> | "fullName"> = {
  prenom: "firstName",
  firstname: "firstName",
  nom: "lastName",
  lastname: "lastName",
  surname: "lastName",
  nomdefamille: "lastName",
  joueur: "fullName",
  nomcomplet: "fullName",
  name: "fullName",
  fullname: "fullName",
  player: "fullName",
  poste: "position",
  position: "position",
  numero: "jerseyNumber",
  no: "jerseyNumber",
  n: "jerseyNumber",
  maillot: "jerseyNumber",
  number: "jerseyNumber",
  jersey: "jerseyNumber",
  jerseynumber: "jerseyNumber",
  pied: "preferredFoot",
  piedfort: "preferredFoot",
  foot: "preferredFoot",
  preferredfoot: "preferredFoot",
  datedenaissance: "dateOfBirth",
  naissance: "dateOfBirth",
  ddn: "dateOfBirth",
  dob: "dateOfBirth",
  dateofbirth: "dateOfBirth",
  birthdate: "dateOfBirth",
};

const POSITION_ALIASES: Record<string, string> = {
  gardien: "GK",
  goalkeeper: "GK",
  g: "GK",
  defenseur: "DC",
  defenseurcentral: "DC",
  dc: "DC",
  cb: "DC",
  lateralgauche: "DG",
  lb: "DG",
  lateraldroit: "DD",
  rb: "DD",
  milieu: "MC",
  milieucentral: "MC",
  cm: "MC",
  milieudefensif: "MDC",
  cdm: "MDC",
  milieuoffensif: "MOC",
  cam: "MOC",
  attaquant: "BU",
  avantcentre: "BU",
  buteur: "BU",
  st: "BU",
  ailiergauche: "AG",
  lw: "AG",
  ailierdroit: "AD",
  rw: "AD",
};

function normalizePosition(value: string): string {
  const upper = value.trim().toUpperCase();
  if ((POSITIONS as readonly string[]).includes(upper)) return upper;
  return POSITION_ALIASES[strip(value)] ?? "";
}

// "12/04/2011", "12-04-2011", "2011-04-12" -> "2011-04-12"; null otherwise.
function normalizeDate(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

// Splits one CSV line, honouring double quotes.
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

// Parses a roster CSV (`;`, `,` or tab separated, header row required).
// Returns the preview rows; an empty array means no player was recognised.
export function parseRosterCsv(input: string): ImportRow[] {
  const lines = input.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const head = lines[0];
  const delimiter = [";", "\t", ","].sort((a, b) => head.split(b).length - head.split(a).length)[0];
  const columns = splitLine(head, delimiter).map((h) => HEADER_ALIASES[strip(h)]);
  if (!columns.some(Boolean)) return [];

  const rows: ImportRow[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitLine(line, delimiter);
    const row: ImportRow = {
      rowId: `row_${index + 1}`,
      firstName: "",
      lastName: "",
      position: "",
      jerseyNumber: null,
      preferredFoot: "RIGHT",
      dateOfBirth: null,
    };
    columns.forEach((field, col) => {
      const value = cells[col] ?? "";
      if (!field || !value) return;
      if (field === "fullName") {
        const [first, ...rest] = value.split(/\s+/);
        row.firstName ||= first;
        row.lastName ||= rest.join(" ");
      } else if (field === "firstName" || field === "lastName") row[field] = value;
      else if (field === "position") row.position = normalizePosition(value);
      else if (field === "jerseyNumber") {
        const n = Number.parseInt(value.replace(/\D/g, ""), 10);
        row.jerseyNumber = Number.isFinite(n) ? n : null;
      } else if (field === "preferredFoot") {
        row.preferredFoot = /^(g|l)/i.test(value.trim()) ? "LEFT" : "RIGHT";
      } else if (field === "dateOfBirth") row.dateOfBirth = normalizeDate(value);
    });
    if (row.firstName || row.lastName) rows.push(row);
  });
  return rows;
}
