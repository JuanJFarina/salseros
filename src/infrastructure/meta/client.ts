import { z } from "zod";

import type { InstagramPublication } from "@/domain/models";
import { ExternalServiceError } from "@/utils/errors";
import { getMetaSettings } from "@/utils/settings";

const mediaTypeSchema = z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]);

const mediaSchema = z.object({
  id: z.string(),
  caption: z.string().optional(),
  media_type: mediaTypeSchema,
  media_url: z.url().optional(),
  thumbnail_url: z.url().optional(),
  permalink: z.url(),
  timestamp: z.string(),
  children: z
    .object({
      data: z.array(
        z.object({
          media_type: mediaTypeSchema,
          media_url: z.url().optional(),
          thumbnail_url: z.url().optional(),
        }),
      ),
    })
    .optional(),
});

const discoverySchema = z.object({
  business_discovery: z.object({
    media: z.object({
      data: z.array(mediaSchema),
    }),
  }),
});

const debugSchema = z.object({
  data: z.object({
    is_valid: z.boolean(),
    expires_at: z.number(),
    type: z.string(),
  }),
});

const sourceProfileSchema = z.object({
  business_discovery: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string().optional(),
    biography: z.string().optional(),
    media: z
      .object({
        data: z.array(
          z.object({
            caption: z.string().optional(),
          }),
        ),
      })
      .optional(),
  }),
});

export type SourceProfile = {
  id: string;
  username: string;
  name: string;
  biography: string;
  recentCaptions: string[];
};

function visualUrls(media: z.infer<typeof mediaSchema>): string[] {
  if (media.media_type === "IMAGE") {
    return media.media_url ? [media.media_url] : [];
  }
  if (media.media_type === "VIDEO") {
    return media.thumbnail_url ? [media.thumbnail_url] : [];
  }
  return (media.children?.data ?? [])
    .map((child) =>
      child.media_type === "IMAGE" ? child.media_url : child.thumbnail_url,
    )
    .filter((url): url is string => Boolean(url));
}

async function metaRequest(url: URL): Promise<unknown> {
  const { accessToken, timeoutMs } = getMetaSettings();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(payload);
    throw new ExternalServiceError(
      "Meta",
      message.success ? message.data.error.message : "Request failed",
    );
  }
  return payload;
}

export async function fetchRecentPublications(
  username: string,
): Promise<InstagramPublication[]> {
  const { graphVersion, igUserId, publicationLimit } = getMetaSettings();
  const fields =
    `business_discovery.username(${username})` +
    `{media.limit(${publicationLimit}){id,caption,media_type,media_url,thumbnail_url,` +
    "permalink,timestamp,children{media_type,media_url,thumbnail_url}}}";
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/${igUserId}`,
  );
  url.searchParams.set("fields", fields);
  const result = discoverySchema.parse(await metaRequest(url));

  return result.business_discovery.media.data.map((media) => ({
    mediaId: media.id,
    caption: media.caption ?? "",
    mediaType: media.media_type,
    permalink: media.permalink,
    publishedAt: media.timestamp,
    visualUrls: visualUrls(media),
  }));
}

export async function fetchSourceProfile(
  username: string,
): Promise<SourceProfile | null> {
  const { graphVersion, igUserId } = getMetaSettings();
  const fields =
    `business_discovery.username(${username})` +
    "{id,username,name,biography,media.limit(3){caption}}";
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/${igUserId}`,
  );
  url.searchParams.set("fields", fields);

  try {
    const result = sourceProfileSchema.parse(await metaRequest(url));
    const profile = result.business_discovery;
    return {
      id: profile.id,
      username: profile.username,
      name: profile.name?.trim() || profile.username,
      biography: profile.biography?.trim() || "",
      recentCaptions: (profile.media?.data ?? [])
        .map((media) => media.caption?.trim())
        .filter((caption): caption is string => Boolean(caption)),
    };
  } catch (error) {
    if (
      error instanceof ExternalServiceError &&
      /Invalid user id|Unsupported get request/i.test(error.message)
    ) {
      return null;
    }
    throw error;
  }
}

export async function inspectMetaToken(now = new Date()) {
  const { accessToken, graphVersion } = getMetaSettings();
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/debug_token`,
  );
  url.searchParams.set("input_token", accessToken);
  const result = debugSchema.parse(await metaRequest(url));
  const expiresAt = new Date(result.data.expires_at * 1000);
  return {
    valid: result.data.is_valid,
    expiresAt: expiresAt.toISOString(),
    warning:
      expiresAt.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000
        ? `Meta token expires at ${expiresAt.toISOString()}`
        : null,
  };
}
