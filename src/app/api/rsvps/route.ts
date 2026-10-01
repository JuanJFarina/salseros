import { rsvpInputSchema } from "@/domain/models";
import { setAttendance } from "@/services/events";
import { AppError, errorResponse } from "@/utils/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = rsvpInputSchema.safeParse(await request.json());
    if (!input.success) {
      throw new AppError(
        "La confirmación no es válida.",
        400,
        "invalid_rsvp",
      );
    }
    return Response.json(
      await setAttendance(
        input.data.eventId,
        input.data.visitorToken,
        input.data.attending,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
