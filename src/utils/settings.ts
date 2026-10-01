import { z } from "zod";

const serviceAccountSchema = z
  .object({
    client_email: z.string().email(),
    private_key: z.string().min(1),
    project_id: z.string().min(1),
  })
  .passthrough();

export type GoogleServiceAccount = z.infer<typeof serviceAccountSchema>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function isFixtureMode(): boolean {
  if (process.env.USE_FIXTURES === "true") {
    return true;
  }
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.GOOGLE_SPREADSHEET_URL?.trim()
  );
}

export function getMetaSettings() {
  return {
    accessToken: requiredEnv("META_ACCESS_TOKEN"),
    igUserId: requiredEnv("META_IG_USER_ID"),
    graphVersion: process.env.META_GRAPH_VERSION?.trim() || "v26.0",
    timeoutMs: positiveInteger("EXTERNAL_REQUEST_TIMEOUT_MS", 15_000),
  };
}

export function getGeminiSettings() {
  return {
    apiKey: requiredEnv("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    maxConcurrency: positiveInteger("GEMINI_MAX_CONCURRENCY", 6),
  };
}

export function getSyncSettings() {
  return {
    password: requiredEnv("SYNC_PASSWORD"),
    maxConcurrency: positiveInteger("SYNC_MAX_CONCURRENCY", 4),
    maxMediaBytes: positiveInteger("MAX_MEDIA_BYTES", 12 * 1024 * 1024),
  };
}

export function getRsvpSettings() {
  return {
    hashSecret: requiredEnv("RSVP_HASH_SECRET"),
  };
}

export function getGoogleSheetsSettings() {
  const spreadsheetUrl = requiredEnv("GOOGLE_SPREADSHEET_URL");
  const match = spreadsheetUrl.match(
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
  );
  if (!match) {
    throw new Error("GOOGLE_SPREADSHEET_URL is invalid");
  }

  const decoded = Buffer.from(
    requiredEnv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"),
    "base64",
  ).toString("utf8");
  const credentials = serviceAccountSchema.parse(JSON.parse(decoded));

  return {
    spreadsheetId: match[1],
    spreadsheetUrl,
    eventsCsvUrl:
      `https://docs.google.com/spreadsheets/d/${match[1]}` +
      "/gviz/tq?tqx=out:csv&sheet=Events",
    credentials,
  };
}
