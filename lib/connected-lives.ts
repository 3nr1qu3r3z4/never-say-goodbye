export const relationshipTypes = [
  { value: "family", label: "Family", group: "Family" },
  { value: "parent", label: "Parent", group: "Family" },
  { value: "child", label: "Child", group: "Family" },
  { value: "sibling", label: "Sibling", group: "Family" },
  { value: "spouse_partner", label: "Spouse/Partner", group: "Family" },
  { value: "close_friend", label: "Close Friend", group: "Close Friends" },
  { value: "mentor", label: "Mentor", group: "Mentors" },
  { value: "other", label: "Other", group: "Other" },
] as const;

export type RelationshipType = (typeof relationshipTypes)[number]["value"];

export function isRelationshipType(value: unknown): value is RelationshipType {
  return relationshipTypes.some((type) => type.value === value);
}

export function relationshipForViewer(
  type: string | null,
  subjectUserId: string | null,
  viewerId: string,
): string | null {
  if (subjectUserId === viewerId) {
    if (type === "parent") return "child";
    if (type === "child") return "parent";
  }
  return type;
}

export function relationshipLabel(type: string | null): string {
  if (!type) return "Unclassified";
  return relationshipTypes.find((item) => item.value === type)?.label
    ?? type.replaceAll("_", " ");
}
