import { getWeeklyEvents } from "@/services/events";
import { errorResponse } from "@/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = Response.json(await getWeeklyEvents());
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
