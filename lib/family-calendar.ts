export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  repeatsYearly: boolean;
  source: string;
};

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function occurrences(events: CalendarEvent[], start: string, end: string): CalendarEvent[] {
  const firstYear = Number(start.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  return events.flatMap((event) => {
    if (!event.repeatsYearly) {
      return event.date >= start && event.date <= end ? [event] : [];
    }
    const dates: CalendarEvent[] = [];
    for (let year = firstYear; year <= lastYear; year++) {
      if (year < Number(event.date.slice(0, 4))) continue;
      const date = `${String(year).padStart(4, "0")}${event.date.slice(4)}`;
      if (validCalendarDate(date) && date >= start && date <= end) {
        dates.push({ ...event, date });
      }
    }
    return dates;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
