import { google, sheets_v4 } from "googleapis";

import { getGoogleSheetsSettings } from "@/utils/settings";

export const SHEET_HEADERS = {
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
  EventRequests: [
    "event_request_id",
    "username",
    "social_name",
    "event_date",
    "event_time",
    "place",
    "status",
    "event_id",
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
} as const;

export type SheetName = keyof typeof SHEET_HEADERS;
export type SheetRow = Record<string, string>;
export type SheetEntry = {
  rowNumber: number;
  row: SheetRow;
};

export class GoogleSheetsStore {
  private readonly spreadsheetId: string;
  private readonly client: sheets_v4.Sheets;
  private schemaReady: Promise<void> | null = null;

  constructor() {
    const settings = getGoogleSheetsSettings();
    this.spreadsheetId = settings.spreadsheetId;
    const auth = new google.auth.GoogleAuth({
      credentials: {
        ...settings.credentials,
        private_key: settings.credentials.private_key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.client = google.sheets({ version: "v4", auth });
  }

  async read(name: SheetName): Promise<SheetRow[]> {
    return (await this.readEntries(name)).map((entry) => entry.row);
  }

  async readEntries(name: SheetName): Promise<SheetEntry[]> {
    await this.ensureSchema();
    const response = await this.client.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${name}!A:Z`,
    });
    const values = (response.data.values ?? []) as unknown[][];
    if (values.length <= 1) {
      return [];
    }

    const headers = [...SHEET_HEADERS[name]];
    return values.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      row: Object.fromEntries(
        headers.map((header, column) => [
          header,
          String(row[column] ?? ""),
        ]),
      ),
    }));
  }

  async append(name: SheetName, row: SheetRow): Promise<void> {
    await this.ensureSchema();
    await this.client.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${name}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [this.valuesFor(name, row)],
      },
    });
  }

  async updateRows(
    updates: {
      name: SheetName;
      rowNumber: number;
      row: SheetRow;
    }[],
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await this.ensureSchema();
    await this.client.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates.map(({ name, rowNumber, row }) => ({
          range: `${name}!A${rowNumber}`,
          values: [this.valuesFor(name, row)],
        })),
      },
    });
  }

  async replace(tables: Partial<Record<SheetName, SheetRow[]>>): Promise<void> {
    await this.ensureSchema();
    const entries = Object.entries(tables) as [SheetName, SheetRow[]][];
    if (entries.length === 0) {
      return;
    }

    await this.client.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: entries.map(([name, rows]) => ({
          range: `${name}!A1`,
          values: [
            [...SHEET_HEADERS[name]],
            ...rows.map((row) => this.valuesFor(name, row)),
          ],
        })),
      },
    });
    await this.client.spreadsheets.values.batchClear({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        ranges: entries.map(
          ([name, rows]) => `${name}!A${rows.length + 2}:Z`,
        ),
      },
    });
  }

  private valuesFor(name: SheetName, row: SheetRow): string[] {
    return SHEET_HEADERS[name].map((header) => row[header] ?? "");
  }

  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.createSchema();
    }
    return this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    const spreadsheet = await this.client.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties.title",
    });
    const existing = new Set(
      (spreadsheet.data.sheets ?? [])
        .map((sheet) => sheet.properties?.title)
        .filter((title): title is string => Boolean(title)),
    );
    const missing = (Object.keys(SHEET_HEADERS) as SheetName[]).filter(
      (name) => !existing.has(name),
    );

    if (missing.length > 0) {
      await this.client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
    }

    const headers = await this.client.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: (Object.keys(SHEET_HEADERS) as SheetName[]).map(
        (name) => `${name}!1:1`,
      ),
    });
    const updates: sheets_v4.Schema$ValueRange[] = [];

    (Object.keys(SHEET_HEADERS) as SheetName[]).forEach((name, index) => {
      const current = headers.data.valueRanges?.[index]?.values?.[0] ?? [];
      if (current.length === 0) {
        updates.push({
          range: `${name}!A1`,
          values: [[...SHEET_HEADERS[name]]],
        });
        return;
      }
      if (current.join("|") !== SHEET_HEADERS[name].join("|")) {
        throw new Error(`${name} headers do not match the SalseRos schema`);
      }
    });

    if (updates.length > 0) {
      await this.client.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates,
        },
      });
    }
  }
}
