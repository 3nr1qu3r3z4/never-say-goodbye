export const relationshipTypes = [
  { value: "family", label: "Family", group: "Family" },
  { value: "close_friend", label: "Close Friend", group: "Close Friends" },
  { value: "mentor", label: "Mentor", group: "Mentors" },
  { value: "other", label: "Other", group: "Other" },
] as const;

export type RelationshipType = (typeof relationshipTypes)[number]["value"];

export function isRelationshipType(value: unknown): value is RelationshipType {
  return relationshipTypes.some((type) => type.value === value);
}
