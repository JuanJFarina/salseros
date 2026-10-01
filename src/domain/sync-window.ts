import { subDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import { ROSARIO_TIME_ZONE } from "./identity";

export function syncWindowKey(now: Date): string {
  const localNow = toZonedTime(now, ROSARIO_TIME_ZONE);
  const day = localNow.getDay();

  if (day === 1 || day === 2) {
    const monday = subDays(localNow, day - 1);
    return `${formatInTimeZone(monday, ROSARIO_TIME_ZONE, "yyyy-MM-dd")}-MON`;
  }

  const daysSinceWednesday = (day - 3 + 7) % 7;
  const wednesday = subDays(localNow, daysSinceWednesday);
  return `${formatInTimeZone(wednesday, ROSARIO_TIME_ZONE, "yyyy-MM-dd")}-WED`;
}
