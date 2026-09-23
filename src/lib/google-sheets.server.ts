type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri: string;
};

type GoogleCell = {
  formattedValue?: string;
  hyperlink?: string;
  textFormatRuns?: Array<{
    format?: { link?: { uri?: string } };
  }>;
};

type GoogleRow = { values?: GoogleCell[] };

export type SheetCodingQuestion = {
  id: string;
  sourceRow: number;
  number: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  problemUrl: string | null;
  solutionUrl: string | null;
  companies: string[];
};

const DEFAULT_SHEET_ID = "1mvlc8EYc3OVVU3X7NKoC0iZJr_45BL_pVxiJec0r94c";
const DEFAULT_SHEET_GID = 0;
const TOKEN_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const CACHE_TTL_MS = 5 * 60_000;

let accessTokenCache: { token: string; expiresAt: number } | null = null;
let questionCache: { questions: SheetCodingQuestion[]; expiresAt: number } | null = null;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function loadCredentials(): Promise<ServiceAccountCredentials> {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (encoded) {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    return parsed as ServiceAccountCredentials;
  }

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return JSON.parse(inline) as ServiceAccountCredentials;

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? `${process.cwd()}/credentials.json`;
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(credentialsPath, "utf8")) as ServiceAccountCredentials;
}

async function getAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  const credentials = await loadCredentials();
  if (!credentials.client_email || !credentials.private_key || !credentials.token_uri) {
    throw new Error("Google service-account credentials are incomplete");
  }

  const issuedAt = Math.floor(Date.now() / 1_000);
  const unsigned = `${jsonToBase64Url({ alg: "RS256", typ: "JWT" })}.${jsonToBase64Url({
    iss: credentials.client_email,
    scope: TOKEN_SCOPE,
    aud: credentials.token_uri,
    iat: issuedAt,
    exp: issuedAt + 3_600,
  })}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(pemToBytes(credentials.private_key)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;

  const response = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google authentication failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Google authentication returned no access token");
  accessTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, (payload.expires_in ?? 3_600) - 120) * 1_000,
  };
  return payload.access_token;
}

function cellText(row: GoogleRow, column: number): string {
  return row.values?.[column]?.formattedValue?.trim() ?? "";
}

function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function cellLink(row: GoogleRow, column: number): string | null {
  const cell = row.values?.[column];
  return safeHttpsUrl(
    cell?.hyperlink ??
      cell?.textFormatRuns?.find((run) => run.format?.link?.uri)?.format?.link?.uri,
  );
}

function normalizeDifficulty(value: string): "easy" | "medium" | "hard" {
  const normalized = value.toLowerCase();
  if (normalized.includes("hard")) return "hard";
  if (normalized.includes("medium")) return "medium";
  return "easy";
}

export async function getGoogleSheetCodingQuestions(): Promise<SheetCodingQuestion[]> {
  if (questionCache && questionCache.expiresAt > Date.now()) return questionCache.questions;

  const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
  const sheetGid = Number(process.env.GOOGLE_SHEET_GID ?? DEFAULT_SHEET_GID);
  const token = await getAccessToken();
  const fields =
    "sheets(properties(sheetId,title),data(rowData(values(formattedValue,hyperlink,textFormatRuns(format(link(uri)))))))";
  const endpoint = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
  endpoint.searchParams.set("includeGridData", "true");
  endpoint.searchParams.set("fields", fields);
  const response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}`);
  const payload = (await response.json()) as {
    sheets?: Array<{
      properties?: { sheetId?: number; title?: string };
      data?: Array<{ rowData?: GoogleRow[] }>;
    }>;
  };
  const sheet =
    payload.sheets?.find((item) => item.properties?.sheetId === sheetGid) ?? payload.sheets?.[0];
  const rows = sheet?.data?.flatMap((grid) => grid.rowData ?? []) ?? [];
  const headerIndex = rows.findIndex(
    (row) =>
      cellText(row, 3).toLowerCase() === "question" &&
      cellText(row, 5).toLowerCase() === "difficulty",
  );
  if (headerIndex < 0) throw new Error("The Google Sheet question header could not be found");

  let topic = "General DSA";
  const questions: SheetCodingQuestion[] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const section = cellText(row, 0);
    if (section) topic = section;
    const title = cellText(row, 3);
    if (!title) continue;
    questions.push({
      id: `google-sheet:${spreadsheetId}:${sheetGid}:${index + 1}`,
      sourceRow: index + 1,
      number: cellText(row, 2),
      title,
      topic,
      difficulty: normalizeDifficulty(cellText(row, 5)),
      problemUrl: cellLink(row, 4),
      solutionUrl: cellLink(row, 6),
      companies: cellText(row, 7)
        .split(/[,;]+|\s{2,}/)
        .map((company) => company.trim())
        .filter(Boolean),
    });
  }
  questionCache = { questions, expiresAt: Date.now() + CACHE_TTL_MS };
  return questions;
}
