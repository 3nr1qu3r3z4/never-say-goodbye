import { groupTreeGeneration, orderTreePeople, treePersonKey } from "@/lib/tree-positioning";

export type ExportPerson = {
  kind: "member" | "placeholder" | "future";
  data: { id: string; linePartnerType: string | null; linePartnerId: string | null };
  name: string;
  relationship: string;
  isOwner: boolean;
  birthYear: number | null;
  deathYear: number | null;
  isHonored: boolean;
};

export type ExportSection = { label: string; people: ExportPerson[] };

export function exportTreeSections(people: ExportPerson[], ownerName: string): ExportSection[] {
  const layout = orderTreePeople(people);
  const names = new Map(people.map((person) => [treePersonKey(person), person.name]));
  const sections: ExportSection[] = [];
  for (const { generation, members } of layout.generations) {
    const { ownerGroup, relativeGroups } = groupTreeGeneration(generation, members);
    const ownerSection = ownerGroup.length ? [{
      label: generation === 0 ? "Household" : generation === -1 ? "Children" : "Grandchildren",
      people: ownerGroup,
    }] : [];
    const relativeSections = Array.from(relativeGroups.entries())
      .sort(([a, first], [b, second]) =>
        Number(Boolean(first.reference)) - Number(Boolean(second.reference)) || a.localeCompare(b))
      .map(([, group]) => ({
        label: `${group.reference ? names.get(group.reference) ?? "Family member" : ownerName}'s ${group.label}`,
        people: group.people,
      }));
    sections.push(...(generation === 0 ? [...relativeSections, ...ownerSection] : [...ownerSection, ...relativeSections]));
  }
  if (layout.unpositioned.length) sections.push({ label: "Additional Family", people: layout.unpositioned });
  return sections;
}
