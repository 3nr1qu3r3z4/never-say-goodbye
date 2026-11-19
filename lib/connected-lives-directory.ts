import { relationshipTypes } from "@/lib/connected-lives";

export type PersonTag = { id: string; label: string };
export type DirectoryConnection = {
  id: string;
  personId: string | null;
  displayName: string;
  relationshipType: string | null;
  acceptedAt: string | null;
  profilePhoto: string | null;
  profileVisible: boolean;
  birthYear: number | null;
  personTags: PersonTag[];
  ownTags: PersonTag[];
};

export function isFamilyRelationship(type: string | null): boolean {
  return relationshipTypes.some((item) => item.value === type && item.group === "Family");
}

export function filterConnections(
  connections: DirectoryConnection[],
  search: string,
  relationship: string,
  tag: string,
  sort: string,
): DirectoryConnection[] {
  const term = search.trim().toLowerCase();
  return connections.filter((connection) => {
    const matchesText = !term || connection.displayName.toLowerCase().includes(term) ||
      connection.personTags.some((item) => item.label.toLowerCase().includes(term));
    const matchesRelationship = relationship === "all" ||
      (relationship === "family-group" ? isFamilyRelationship(connection.relationshipType)
        : relationship === "unclassified" ? !connection.relationshipType
          : connection.relationshipType !== null && `type:${connection.relationshipType}` === relationship);
    const matchesTag = tag === "all" ||
      connection.personTags.some((item) => `tag:${item.label.toLowerCase()}` === tag);
    return matchesText && matchesRelationship && matchesTag;
  }).sort((a, b) => {
    const alphabetical = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
    if (sort === "az") return alphabetical;
    if (sort === "za") return -alphabetical;
    if (!a.acceptedAt && !b.acceptedAt) return alphabetical;
    if (!a.acceptedAt) return 1;
    if (!b.acceptedAt) return -1;
    const difference = Date.parse(a.acceptedAt) - Date.parse(b.acceptedAt);
    return (sort === "oldest" ? difference : -difference) || alphabetical;
  });
}
