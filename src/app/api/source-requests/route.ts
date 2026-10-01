import { sourceRequestInputSchema } from "@/domain/models";
import { submitSourceRequest } from "@/services/events";
import { AppError, errorResponse } from "@/utils/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = sourceRequestInputSchema.safeParse(await request.json());
    if (!input.success) {
      throw new AppError(
        "Ingresá un usuario de Instagram.",
        400,
        "invalid_request",
      );
    }
    const result = await submitSourceRequest(input.data.username);
    return Response.json(result, {
      status: result.outcome === "created" ? 201 : 200,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
