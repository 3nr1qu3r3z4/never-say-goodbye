export type TreePosition = {
  generation: number;
  partner: boolean;
};

const relationships: Record<string, TreePosition> = {};

function register(labels: string[], generation: number, partner = false) {
  for (const label of labels) relationships[label] = { generation, partner };
}

register(["grandparent", "grandmother", "grandfather", "grandma", "grandpa", "grandmom", "granddad", "nana", "papa"], 2);
register(["parent", "mother", "father", "mom", "mum", "dad", "mommy", "daddy", "mama"], 1);
register(["sibling", "brother", "sister"], 0);
register(["spouse", "partner", "wife", "husband"], 0, true);
register(["child", "son", "daughter"], -1);
register(["grandchild", "grandson", "granddaughter"], -2);

export function positionRelationship(relationship: string | null | undefined): TreePosition | null {
  const label = (relationship ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
  return Object.hasOwn(relationships, label) ? relationships[label] : null;
}

type PositionedPerson = {
  kind: string;
  data: { id: string; linePartnerType?: string | null; linePartnerId?: string | null };
  name: string;
  isOwner: boolean;
  relationship: string | null;
};

export function treePersonKey(person: PositionedPerson): string {
  return `${person.kind}:${person.data.id}`;
}

export function treeReferenceKey(person: PositionedPerson): string | null {
  const { linePartnerType, linePartnerId } = person.data;
  return linePartnerType && linePartnerId ? `${linePartnerType}:${linePartnerId}` : null;
}

export function orderTreePeople<T extends PositionedPerson>(people: T[]) {
  const groups = new Map<number, T[]>();
  const owner = people.find((person) => person.isOwner);
  const childrenByReference = new Map<string, T[]>();
  const resolved = new Set<string>();
  for (const person of people) {
    if (person.isOwner || !owner) continue;
    const reference = treeReferenceKey(person) ?? treePersonKey(owner);
    const children = childrenByReference.get(reference) ?? [];
    children.push(person);
    childrenByReference.set(reference, children);
  }
  const queue: { person: T; generation: number }[] = owner ? [{ person: owner, generation: 0 }] : [];
  for (let index = 0; index < queue.length; index++) {
    const { person, generation } = queue[index];
    const key = treePersonKey(person);
    if (resolved.has(key)) continue;
    resolved.add(key);
    const group = groups.get(generation) ?? [];
    group.push(person);
    groups.set(generation, group);
    for (const relative of childrenByReference.get(key) ?? []) {
      const position = positionRelationship(relative.relationship);
      if (position) queue.push({ person: relative, generation: generation + position.generation });
    }
  }
  const unpositioned = people.filter((person) => !resolved.has(treePersonKey(person)));
  const compareNames = (a: T, b: T) => a.name.localeCompare(b.name);
  const generations = Array.from(groups.entries()).sort(([a], [b]) => b - a).map(([generation, members]) => {
    if (generation !== 0) return { generation, members: members.sort(compareNames) };
    const siblings = members.filter((person) => !person.isOwner && !treeReferenceKey(person) && !positionRelationship(person.relationship)?.partner).sort(compareNames);
    const owners = members.filter((person) => person.isOwner);
    const partners = members.filter((person) => !person.isOwner && !treeReferenceKey(person) && positionRelationship(person.relationship)?.partner).sort(compareNames);
    const otherRelatives = members.filter((person) => !person.isOwner && treeReferenceKey(person)).sort(compareNames);
    const midpoint = Math.ceil(siblings.length / 2);
    return { generation, members: [...siblings.slice(0, midpoint), ...owners, ...partners, ...siblings.slice(midpoint), ...otherRelatives] };
  });
  return { generations, unpositioned: unpositioned.sort(compareNames) };
}
