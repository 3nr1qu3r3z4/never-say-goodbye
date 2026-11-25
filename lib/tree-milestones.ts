export type TreeMilestone = {
  id: string;
  treeId: string;
  subjectType: "user" | "placeholder" | "future";
  subjectId: string;
  personName: string;
  kind: "birthday" | "anniversary" | "wedding" | "graduation" | "custom";
  title: string;
  year: number | null;
  month: number | null;
  day: number | null;
  repeatsYearly: boolean;
  canEdit: boolean;
};

export function milestoneDate(milestone: Pick<TreeMilestone, "year" | "month" | "day">) {
  const { year, month, day } = milestone;
  if (!year && !month) return "Date not set";
  const monthName = month
    ? new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, month - 1, 1)))
    : "";
  return [monthName, day, year].filter((part) => part !== null && part !== "").join(" ");
}
