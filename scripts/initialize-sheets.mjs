import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

const headers = {
  Sources: [
    "source_id",
    "username",
    "enabled",
    "last_successful_window",
    "last_checked_at",
    "last_error",
    "created_at",
    "updated_at",
  ],
  Events: [
    "event_id",
    "source_id",
    "instagram_account",
    "social_name",
    "next_social_date",
    "ends_at",
    "address",
    "status",
    "attendants",
    "source_media_ids",
    "source_permalinks",
    "extraction_confidence",
    "source_published_at",
    "created_at",
    "updated_at",
    "time_approximate",
  ],
  RSVPs: ["rsvp_id", "event_id", "attending", "created_at", "updated_at"],
  SourceRequests: [
    "request_id",
    "username",
    "status",
    "requested_at",
    "reviewed_at",
    "review_note",
  ],
  ExtractionReviews: [
    "review_id",
    "source_id",
    "media_id",
    "permalink",
    "caption_result_json",
    "vision_result_json",
    "reason",
    "status",
    "created_at",
    "resolved_at",
  ],
  SyncRuns: [
    "sync_run_id",
    "invocation_id",
    "source_id",
    "window_key",
    "status",
    "publications_checked",
    "started_at",
    "completed_at",
    "error_code",
    "error_message",
  ],
};

const initialSources = [
  "azukita.sb",
  "lamalicia.salsaybachata",
  "siempre.mister",
  "la_fest_sb",
  "echamelaculpa.bs",
  "elite.danceclub",
  "la_clave_rio",
  "rumbavanaok",
  "asereok",
  "patipami.d7",
  "salsa.vana_",
];

const recurringSources = [
  {
    username: "sentimientotorito.rosario1",
    note: "Manual recurring event; Meta scan omitted because announcements are Stories-only",
  },
  {
    username: "salsipuedesrosario",
    note: "Manual recurring event; Meta scan omitted",
  },
];

const initialSourceDecisions = [
  {
    username: "echamelaculpa.sb",
    note: "El usuario correcto es echamelaculpa.bs; la cuenta corregida fue validada y habilitada.",
  },
  {
    username: "lahori.sb",
    note: "Meta Business Discovery devolvió Invalid user id; la cuenta no es accesible mediante la API oficial.",
  },
  {
    username: "la_latina_syb",
    note: "Meta Business Discovery devolvió Invalid user id; la cuenta no es accesible mediante la API oficial.",
  },
  {
    username: "lacasadela.bachata",
    note: "Meta Business Discovery devolvió Invalid user id; la cuenta no es accesible mediante la API oficial.",
  },
  {
    username: "rosariosalsaybachata",
    note: "Meta Business Discovery devolvió Invalid user id; la cuenta no es accesible mediante la API oficial.",
  },
  {
    username: "salvaje_salsa.bachata",
    note: "Meta Business Discovery devolvió Invalid user id; la cuenta no es accesible mediante la API oficial.",
  },
  {
    username: "sentimientotorito.rosario1",
    note: "Cuenta omitida: anuncia sus sociales únicamente mediante Stories, que Business Discovery no permite consultar.",
  },
];

const envPath = resolve(".env");
const envLines = readFileSync(envPath, "utf8").split(/\r?\n/);
const env = new Map();

for (const line of envLines) {
  const separator = line.indexOf("=");
  if (separator <= 0 || line.trimStart().startsWith("#")) {
    continue;
  }
  env.set(
    line.slice(0, separator).trim(),
    line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ""),
  );
}

const spreadsheetUrl = env.get("GOOGLE_SPREADSHEET_URL");
const credentialsBase64 = env.get("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
if (!spreadsheetUrl || !credentialsBase64) {
  throw new Error("Google Sheets environment is incomplete");
}

const spreadsheetId = spreadsheetUrl.match(
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
)?.[1];
if (!spreadsheetId) {
  throw new Error("GOOGLE_SPREADSHEET_URL is invalid");
}

const credentials = JSON.parse(
  Buffer.from(credentialsBase64, "base64").toString("utf8"),
);
const auth = new google.auth.GoogleAuth({
  credentials: {
    ...credentials,
    private_key: credentials.private_key.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheet = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: "sheets.properties.title",
});
const existingTitles = new Set(
  (spreadsheet.data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter(Boolean),
);
const missingTitles = Object.keys(headers).filter(
  (title) => !existingTitles.has(title),
);

if (missingTitles.length > 0) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missingTitles.map((title) => ({
        addSheet: { properties: { title } },
      })),
    },
  });
}

const ranges = Object.keys(headers).map((name) => `${name}!1:1`);
const currentHeaders = await sheets.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges,
});
const headerUpdates = [];

Object.entries(headers).forEach(([name, expected], index) => {
  const current = currentHeaders.data.valueRanges?.[index]?.values?.[0] ?? [];
  if (current.length === 0) {
    headerUpdates.push({ range: `${name}!A1`, values: [expected] });
    return;
  }
  if (current.join("|") !== expected.join("|")) {
    throw new Error(`${name} headers do not match the SalseRos schema`);
  }
});

if (headerUpdates.length > 0) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: headerUpdates,
    },
  });
}

const currentSources = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "Sources!A:H",
});
const existingUsernames = new Set(
  (currentSources.data.values ?? []).slice(1).map((row) => row[1]),
);
const timestamp = new Date().toISOString();
const newSources = initialSources
  .filter((username) => !existingUsernames.has(username))
  .map((username) => [
    `src_${createHash("sha256").update(username).digest("hex").slice(0, 24)}`,
    username,
    "true",
    "",
    "",
    "",
    timestamp,
    timestamp,
  ]);
const newRecurringSources = recurringSources
  .filter(({ username }) => !existingUsernames.has(username))
  .map(({ username, note }) => [
    `src_${createHash("sha256").update(username).digest("hex").slice(0, 24)}`,
    username,
    "false",
    "",
    "",
    note,
    timestamp,
    timestamp,
  ]);

if (newSources.length + newRecurringSources.length > 0) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sources!A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [...newSources, ...newRecurringSources] },
  });
}

const currentRequests = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "SourceRequests!A:F",
});
const [requestHeaders, ...requestRows] = currentRequests.data.values ?? [
  headers.SourceRequests,
];
const requestIndex = Object.fromEntries(
  requestHeaders.map((header, index) => [header, index]),
);
const requestsByUsername = new Map(
  requestRows.map((row) => [row[requestIndex.username], row]),
);

for (const decision of initialSourceDecisions) {
  const existing = requestsByUsername.get(decision.username);
  if (existing) {
    existing[requestIndex.status] = "rejected";
    existing[requestIndex.reviewed_at] = timestamp;
    existing[requestIndex.review_note] = decision.note;
    continue;
  }
  requestRows.push([
    `req_${createHash("sha256").update(decision.username).digest("hex").slice(0, 24)}`,
    decision.username,
    "rejected",
    timestamp,
    timestamp,
    decision.note,
  ]);
}

await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: "SourceRequests!A1",
  valueInputOption: "RAW",
  requestBody: { values: [requestHeaders, ...requestRows] },
});

let fixtureSettingFound = false;
const updatedEnv = envLines.map((line) => {
  if (!line.match(/^\s*USE_FIXTURES=/)) {
    return line;
  }
  fixtureSettingFound = true;
  return "USE_FIXTURES=false";
});
if (!fixtureSettingFound) {
  updatedEnv.push("USE_FIXTURES=false");
}
writeFileSync(envPath, `${updatedEnv.join("\n").trimEnd()}\n`, "utf8");

console.log(
  `Initialized ${Object.keys(headers).length} tabs, added ${newSources.length + newRecurringSources.length} sources, and recorded ${initialSourceDecisions.length} decisions.`,
);
