export function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  const fmt = (n: number, unit: string) =>
    `${n} ${unit}${n !== 1 ? "s" : ""}`;

  if (diff > 0) {
    if (days > 0) return `in ${fmt(days, "day")}`;
    if (hours > 0) return `in ${fmt(hours, "hour")}`;
    return `in ${fmt(minutes, "minute")}`;
  } else {
    if (days > 0) return `${fmt(days, "day")} ago`;
    if (hours > 0) return `${fmt(hours, "hour")} ago`;
    if (minutes > 0) return `${fmt(minutes, "minute")} ago`;
    return "just now";
  }
}
