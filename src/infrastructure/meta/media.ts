import { getMetaSettings, getSyncSettings } from "@/utils/settings";

export type VisionAsset = {
  data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

const supportedTypes = new Set<VisionAsset["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function downloadVisual(url: string): Promise<VisionAsset> {
  const { timeoutMs } = getMetaSettings();
  const { maxMediaBytes } = getSyncSettings();
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Media download returned ${response.status}`);
  }

  const mimeType = response.headers
    .get("content-type")
    ?.split(";")[0] as VisionAsset["mimeType"] | undefined;
  if (!mimeType || !supportedTypes.has(mimeType)) {
    throw new Error("Media type is not supported");
  }

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > maxMediaBytes) {
    throw new Error("Media exceeds the size limit");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxMediaBytes) {
    throw new Error("Media exceeds the size limit");
  }
  return {
    data: Buffer.from(bytes).toString("base64"),
    mimeType,
  };
}

export async function downloadVisualAssets(
  urls: string[],
): Promise<VisionAsset[]> {
  const outcomes = await Promise.allSettled(urls.map(downloadVisual));
  outcomes
    .filter((outcome) => outcome.status === "rejected")
    .forEach((outcome) => console.error("Visual download failed", outcome.reason));
  return outcomes
    .filter(
      (outcome): outcome is PromiseFulfilledResult<VisionAsset> =>
        outcome.status === "fulfilled",
    )
    .map((outcome) => outcome.value);
}
