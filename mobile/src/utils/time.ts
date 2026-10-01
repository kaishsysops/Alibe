// "5m", "3h", "2d" for compact lists; "5 minutes ago" etc. for detail screens.
export function timeAgo(iso: string, long = false): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const unit = (n: number, short: string, word: string) => (long ? `${n} ${word}${n === 1 ? "" : "s"} ago` : `${n}${short}`);
  if (mins < 1) return long ? "Just now" : "now";
  if (mins < 60) return unit(mins, "m", "minute");
  const hours = Math.floor(mins / 60);
  if (hours < 24) return unit(hours, "h", "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return unit(days, "d", "day");
  const months = Math.floor(days / 30);
  return unit(months, "mo", "month");
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
