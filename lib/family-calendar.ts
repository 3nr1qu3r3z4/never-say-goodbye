import type { TreeMilestone } from "@/lib/tree-milestones";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  repeatsYearly: boolean;
  source: string;
};

export function calendarEventIcon(id: string): string {
  if (id.startsWith("birthday:") || id.startsWith("placeholder-birthday:")) return "🎂";
  if (id.startsWith("memorial:") || id.startsWith("placeholder-memorial:") || id.startsWith("honored-passing:")) return "🕊";
  if (id.startsWith("anniversary:")) return "💍";
  if (id.startsWith("tree-birthday:")) return "🎂";
  if (id.startsWith("tree-anniversary:") || id.startsWith("tree-wedding:")) return "💍";
  if (id.startsWith("tree-graduation:")) return "🎓";
  if (id.startsWith("future:") || id.startsWith("milestone:")) return "✨";
  return "📅";
}

export function datedCalendarMilestones(milestones: TreeMilestone[]): CalendarEvent[] {
  return milestones.flatMap((milestone) => {
    if (milestone.month === null || milestone.day === null) return [];
    const monthDay = `${String(milestone.month).padStart(2, "0")}-${String(milestone.day).padStart(2, "0")}`;
    return [{
      id: `tree-${milestone.kind}:${milestone.id}`,
      title: `${milestone.personName} ${milestone.title}`,
      date: milestone.year === null ? `--${monthDay}` : `${milestone.year}-${monthDay}`,
      repeatsYearly: milestone.repeatsYearly,
      source: "Legacy Tree™",
    }];
  });
}

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
      if (!event.date.startsWith("--") && year < Number(event.date.slice(0, 4))) continue;
      const monthDay = event.date.startsWith("--") ? event.date.slice(2) : event.date.slice(5);
      const date = `${String(year).padStart(4, "0")}-${monthDay}`;
      if (validCalendarDate(date) && date >= start && date <= end) {
        dates.push({ ...event, date });
      }
    }
    return dates;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function upcomingOccurrences(events: CalendarEvent[], today: string): CalendarEvent[] {
  const currentYear = Number(today.slice(0, 4));
  return events.flatMap((event) => {
    if (!event.repeatsYearly) {
      return validCalendarDate(event.date) && event.date >= today ? [event] : [];
    }
    const firstYear = event.date.startsWith("--") ? currentYear : Math.max(currentYear, Number(event.date.slice(0, 4)));
    if (!Number.isInteger(firstYear) || firstYear > 9999) return [];
    const start = firstYear === currentYear ? today : `${firstYear}-01-01`;
    const end = `${Math.min(firstYear + 8, 9999)}-12-31`;
    return occurrences([event], start, end).slice(0, 1);
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
