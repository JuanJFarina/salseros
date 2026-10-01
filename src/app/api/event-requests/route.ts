import { eventRequestInputSchema } from "@/domain/models";
import { submitCommunityEvent } from "@/services/event-submissions";
import { AppError, errorResponse } from "@/utils/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = eventRequestInputSchema.safeParse(await request.json());
    if (!input.success) {
      throw new AppError(
        "Completá fecha, hora, lugar e Instagram.",
        400,
        "invalid_event_request",
      );
    }
    const result = await submitCommunityEvent(input.data);
    const status =
      result.outcome === "approved"
        ? 201
        : result.outcome === "pending"
          ? 202
          : 200;
    return Response.json(result, { status });
  } catch (error) {
    return errorResponse(error);
  }
}
