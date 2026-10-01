import { createHash, timingSafeEqual } from "node:crypto";

import { synchronizeSources } from "@/services/sync";
import { errorResponse } from "@/utils/errors";
import { getSyncSettings } from "@/utils/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function GET(request: Request) {
  try {
    const supplied = new URL(request.url).searchParams.get("key") ?? "";
    if (!timingSafeEqual(digest(supplied), digest(getSyncSettings().password))) {
      return Response.json(
        { error: { code: "unauthorized", message: "Unauthorized" } },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const result = await synchronizeSources();
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
