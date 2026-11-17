import { relationshipTypes, type RelationshipType } from "@/lib/connected-lives";

export default function RelationshipOptions({
  selected,
}: {
  selected?: RelationshipType | null;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-200">
        How do you know this person?
      </legend>
      <div className="mt-3 space-y-2">
        {relationshipTypes.map((type) => (
          <label
            key={type.value}
            className="flex items-center gap-2 text-sm text-slate-300"
          >
            <input
              type="radio"
              name="relationshipType"
              value={type.value}
              defaultChecked={selected === type.value}
              required
              className="accent-[#D8A35B]"
            />
            {type.label}
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Both people can edit this relationship.
      </p>
    </fieldset>
  );
}
