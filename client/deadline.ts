export type Note = {
  id: string;
  name: string;
  title: string;
  customTitle: boolean;
  detail: string;
  deadline: string | null;
  done: boolean;
  hidden: boolean;
  modifiedAt: string;
};

export type Urgency = { color: string; icon: string; label: string; tinted: boolean };

const HOUR = 3_600_000;

// A date-only deadline is due at the end of that day.
export const dueMs = (deadline: string) => {
  const [d, t] = deadline.split(" ");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t ? t.split(":").map(Number) : [23, 59];
  return new Date(y, mo - 1, da, h, mi).getTime();
};

// Colors are fixed hex values that stay readable on light and dark themes.
export function urgency(note: Pick<Note, "deadline" | "done">, now = Date.now()): Urgency {
  if (note.done) return { color: "#3fb68b", icon: "✅", label: "Đã xong", tinted: true };
  if (!note.deadline) return { color: "#8a8f98", icon: "📝", label: "Không có hạn", tinted: false };
  const left = dueMs(note.deadline) - now;
  if (left < 0) return { color: "#e5604d", icon: "🔥", label: "Quá hạn", tinted: true };
  if (left <= 24 * HOUR) {
    const h = Math.max(1, Math.round(left / HOUR));
    return { color: "#e08a45", icon: "⏰", label: `Còn ${h} giờ`, tinted: true };
  }
  const days = Math.ceil(left / (24 * HOUR));
  if (days <= 3) return { color: "#d9a441", icon: "⏳", label: `Còn ${days} ngày`, tinted: true };
  return { color: "#5b8def", icon: "📅", label: `Còn ${days} ngày`, tinted: true };
}
