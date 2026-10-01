import { createHash } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";

export const ROSARIO_TIME_ZONE = "America/Argentina/Cordoba";

export function normalizeInstagramUsername(value: string): string {
  const username = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    throw new Error("El usuario de Instagram no es válido.");
  }
  return username;
}

export function normalizeEventText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function sourceIdFor(username: string): string {
  return `src_${compactHash(normalizeInstagramUsername(username))}`;
}

export function eventIdFor(
  username: string,
  startsAt: string,
  name: string,
): string {
  const localDate = formatInTimeZone(
    new Date(startsAt),
    ROSARIO_TIME_ZONE,
    "yyyy-MM-dd",
  );
  const identity = [
    normalizeInstagramUsername(username),
    localDate,
    normalizeEventText(name),
  ].join("|");
  return `evt_${compactHash(identity)}`;
}

export function reviewIdFor(sourceId: string, mediaId: string): string {
  return `rev_${compactHash(`${sourceId}|${mediaId}`)}`;
}

export function requestIdFor(username: string): string {
  return `req_${compactHash(normalizeInstagramUsername(username))}`;
}

export function eventRequestIdFor(
  username: string,
  date: string,
  time: string,
  place: string,
): string {
  const identity = [
    normalizeInstagramUsername(username),
    date,
    time,
    normalizeEventText(place),
  ].join("|");
  return `ereq_${compactHash(identity)}`;
}

export function syncRunIdFor(
  sourceId: string,
  windowKey: string,
  invocationId: string,
): string {
  return `run_${compactHash(`${sourceId}|${windowKey}|${invocationId}`)}`;
}
