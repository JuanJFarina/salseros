import { createHash, timingSafeEqual } from "node:crypto";

import { normalizeInstagramUsername } from "@/domain/identity";
import { synchronizeSources } from "@/services/sync";
import { AppError, errorResponse } from "@/utils/errors";
import { getSyncSettings } from "@/utils/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const supplied = url.searchParams.get("key") ?? "";
    if (!timingSafeEqual(digest(supplied), digest(getSyncSettings().password))) {
      return Response.json(
        { error: { code: "unauthorized", message: "Unauthorized" } },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const rawSource = url.searchParams.get("source");
    let source: string | undefined;
    if (rawSource) {
      try {
        source = normalizeInstagramUsername(rawSource);
      } catch {
        throw new AppError(
          "La cuenta solicitada no es válida.",
          400,
          "invalid_source",
        );
      }
    }
    const result = await synchronizeSources(new Date(), {
      source,
      force: url.searchParams.get("force") === "true",
    });
    return Response.json(result.response, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
