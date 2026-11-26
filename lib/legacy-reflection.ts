import { orderTreePeople } from "@/lib/tree-positioning";

export type ReflectionTreePerson = {
  kind: "member" | "placeholder" | "future";
  data: { id: string; linePartnerType: string | null; linePartnerId: string | null };
  name: string;
  relationship: string | null;
  isOwner: boolean;
};

export type ReflectionTree = {
  people: number;
  generations: number;
  hasUnpositioned: boolean;
};

export function summarizeReflectionTree(people: ReflectionTreePerson[]): ReflectionTree | null {
  if (!people.length) return null;
  const layout = orderTreePeople(people);
  return {
    people: people.length,
    generations: layout.generations.length,
    hasUnpositioned: layout.unpositioned.length > 0,
  };
}

export function legacyReflection(
  counts: { sharedMoments: number; personalMoments: number; connectedLives: number },
  tree: ReflectionTree | null,
  day: number,
): string {
  const reflections: string[] = [];
  if (tree && tree.people > 1) {
    const people = `${tree.people} people`;
    reflections.push(tree.hasUnpositioned
      ? `Your Legacy Tree™ includes ${people}.`
      : `Your Legacy Tree™ includes ${people} across ${tree.generations} ${tree.generations === 1 ? "generation" : "generations"}.`);
  }
  if (counts.sharedMoments > 0) {
    reflections.push(`You have preserved ${counts.sharedMoments} shared ${counts.sharedMoments === 1 ? "memory" : "memories"}.`);
  }
  if (counts.personalMoments > 0) {
    reflections.push(`You have preserved ${counts.personalMoments} personal ${counts.personalMoments === 1 ? "moment" : "moments"}.`);
  }
  if (counts.connectedLives > 0) {
    reflections.push(`You are connected with ${counts.connectedLives} ${counts.connectedLives === 1 ? "person" : "people"} through Connected Lives™.`);
  }
  if (!reflections.length) return "Every memory and connection helps tell your family's story.";
  return reflections[((day % reflections.length) + reflections.length) % reflections.length];
}
