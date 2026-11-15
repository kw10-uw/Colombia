import { type Row, type Settings } from "./model";
export function colombiaDate(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("-");
}
export const orderedChapters = (rows: Row[]) =>
  rows
    .filter((r) => !r.deleted && r.kind === "destination")
    .sort(
      (a, b) =>
        (a.data.order ?? 0) - (b.data.order ?? 0) || a.id.localeCompare(b.id),
    );
export function chapterFor(row: Row, chapters: Row[]) {
  if (row.data.chapterId)
    return chapters.find((c) => c.id === row.data.chapterId);
  const matches = chapters.filter(
    (c) =>
      c.data.title.toLocaleLowerCase() === row.data.city?.toLocaleLowerCase(),
  );
  return (
    matches.find(
      (c) =>
        row.data.date &&
        c.data.date &&
        c.data.endDate &&
        row.data.date >= c.data.date &&
        row.data.date <= c.data.endDate,
    ) || matches[0]
  );
}
export function dateRange(start?: string, end?: string) {
  if (!start) return [];
  const last = end || start;
  if (last < start) return [];
  const days: string[] = [];
  const date = new Date(start + "T12:00:00Z");
  for (let i = 0; i < 366 && Number.isFinite(date.getTime()); i++) {
    const value = date.toISOString().slice(0, 10);
    if (value > last) break;
    days.push(value);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}
export function chapterDays(chapter: Row, activities: Row[]) {
  return [
    ...new Set([
      ...dateRange(chapter.data.date, chapter.data.endDate),
      ...activities.map((r) => r.data.date).filter((d): d is string => !!d),
    ]),
  ].sort();
}
export const sortActivities = (a: Row, b: Row) =>
  (a.data.date || "9999").localeCompare(b.data.date || "9999") ||
  (a.data.time || "99").localeCompare(b.data.time || "99") ||
  (a.data.order || 0) - (b.data.order || 0) ||
  a.id.localeCompare(b.id);
export function linkedStays(item: Row, rows: Row[]) {
  return rows.filter(
    (s) =>
      s.kind === "stay" &&
      !s.deleted &&
      ((item.data.stayIds || []).includes(s.id) ||
        s.data.activityId === item.id),
  );
}
export function tripIsToday(rows: Row[], settings: Settings, today: string) {
  if (settings.startDate && settings.endDate)
    return today >= settings.startDate && today <= settings.endDate;
  const dates = rows
    .filter(
      (r) =>
        !r.deleted && ["destination", "activity", "travel"].includes(r.kind),
    )
    .flatMap((r) => [r.data.date, r.data.endDate, r.data.arrivalDate])
    .filter((date): date is string => !!date)
    .sort();
  return (
    dates.length > 0 && today >= dates[0] && today <= dates[dates.length - 1]
  );
}
export function todaySchedule(rows: Row[], today: string) {
  return rows
    .filter(
      (r) =>
        !r.deleted &&
        ((r.kind === "activity" && r.data.date === today) ||
          (r.kind === "travel" &&
            (r.data.date === today || r.data.arrivalDate === today))),
    )
    .sort((a, b) => {
      const time = (r: Row) =>
        r.kind === "travel" && r.data.date !== today
          ? r.data.arrivalTime || "99"
          : r.data.time || "99";
      return time(a).localeCompare(time(b));
    });
}
export const travelModes = [
  "Plane",
  "Bus",
  "Train",
  "Car",
  "Boat",
  "Other",
] as const;
