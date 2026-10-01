import { GoogleGenAI, type ContentListUnion } from "@google/genai";
import { z } from "zod";

import type { ExtractionResult } from "@/domain/models";
import type { VisionAsset } from "@/infrastructure/meta/media";
import { ExternalServiceError } from "@/utils/errors";
import { getGeminiSettings } from "@/utils/settings";

const candidateSchema = z.object({
  name: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  address: z.string(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

const extractionSchema = z.object({
  events: z.array(candidateSchema),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          startsAt: { type: "string" },
          endsAt: { type: ["string", "null"] },
          address: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "name",
          "startsAt",
          "endsAt",
          "address",
          "evidence",
          "confidence",
        ],
      },
    },
  },
  required: ["events"],
};

let client: GoogleGenAI | null = null;

function geminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getGeminiSettings().apiKey });
  }
  return client;
}

async function generate(
  contents: ContentListUnion,
): Promise<ExtractionResult> {
  const { model } = getGeminiSettings();
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await geminiClient().models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0,
        },
      });
      if (!response.text) {
        throw new Error("Gemini returned no text");
      }
      return extractionSchema.parse(JSON.parse(response.text));
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  console.error("Gemini extraction failed", lastError);
  throw new ExternalServiceError("Gemini", "Event extraction failed");
}

export async function extractCaptionEvents(
  caption: string,
  publishedAt: string,
): Promise<ExtractionResult> {
  if (!caption.trim()) {
    return { events: [] };
  }

  return generate(
    [
      "Extract future dance-social events from this Instagram caption.",
      "Return zero events when the publication is retrospective, a class only, or contains no event announcement.",
      "Resolve Spanish dates relative to the publication timestamp.",
      "Use ISO 8601 timestamps with Argentina offset -03:00.",
      "Use the advertised social name, full street address, and explicit evidence.",
      `Publication timestamp: ${publishedAt}`,
      `Caption:\n${caption}`,
    ].join("\n"),
  );
}

export async function extractVisionEvents(
  assets: VisionAsset[],
  publishedAt: string,
): Promise<ExtractionResult> {
  if (assets.length === 0) {
    return { events: [] };
  }

  return generate([
    {
      role: "user",
      parts: [
        {
          text: [
            "Extract future dance-social events visible in these Instagram publication images.",
            "Do not assume details that are not visibly present.",
            "Return zero events when the images contain no event announcement.",
            "Resolve Spanish dates relative to the publication timestamp.",
            "Use ISO 8601 timestamps with Argentina offset -03:00.",
            `Publication timestamp: ${publishedAt}`,
          ].join("\n"),
        },
        ...assets.map((asset) => ({
          inlineData: {
            data: asset.data,
            mimeType: asset.mimeType,
          },
        })),
      ],
    },
  ]);
}
