"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addFamilyMember,
  searchFamilyMomentMakers,
  type AddFamilyMemberState,
} from "@/app/actions/family-tree";
import { positionRelationship } from "@/lib/tree-positioning";

type FamilyTreeOption = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  people: { type: string; id: string; name: string; isPartner: boolean }[];
};
type AccountChoice = "existing" | "placeholder" | "future";
type SearchResult = { id: string; displayName: string };

const relationships = [
  "Mother", "Father", "Brother", "Sister", "Son", "Daughter",
  "Grandmother", "Grandfather", "Grandchild", "Aunt", "Uncle", "Cousin",
  "Spouse", "Partner", "Other",
];
const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20";
const choiceClassName =
  "min-h-12 min-w-0 break-words rounded-xl border border-[color:var(--nsg-border)]/15 px-4 py-3 text-left text-sm text-white transition hover:border-[color:var(--nsg-accent)]/50 aria-pressed:border-[color:var(--nsg-accent)] aria-pressed:bg-[color:var(--nsg-accent)]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]";
const buttonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-7 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]";

function meInTree(tree: FamilyTreeOption, userId: string) {
  return tree.ownerId === userId ? "owner" : `member:${userId}`;
}

export default function FamilyMemberForm({
  trees,
  userId,
}: {
  trees: FamilyTreeOption[];
  userId: string;
}) {
  const [step, setStep] = useState(1);
  const [treeId, setTreeId] = useState(trees[0]?.id ?? "");
  const [reference, setReference] = useState(trees[0] ? meInTree(trees[0], userId) : "");
  const [relationship, setRelationship] = useState("");
  const [otherRelationship, setOtherRelationship] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountChoice, setAccountChoice] = useState<AccountChoice | null>(null);
  const [searchName, setSearchName] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, startSearch] = useTransition();
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [notes, setNotes] = useState("");
  const [state, formAction, isPending] = useActionState<AddFamilyMemberState, FormData>(addFamilyMember, {});
  const selectedTree = trees.find((tree) => tree.id === treeId);

  if (!selectedTree) {
    return <p className="text-sm text-slate-400">Create or join a Legacy Tree™ before adding family members.</p>;
  }

  const people = [
    { value: "owner", name: selectedTree.ownerName, isMe: selectedTree.ownerId === userId, isPartner: selectedTree.people.some((person) => person.type === "member" && person.id === userId && person.isPartner) },
    ...selectedTree.people.map((person) => ({
      value: `${person.type}:${person.id}`,
      name: person.name,
      isMe: person.type === "member" && person.id === userId,
      isPartner: selectedTree.ownerId === userId && person.isPartner,
    })),
  ].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  const selectedPerson = people.find((person) => person.value === reference);
  const relativeName = selectedPerson?.isMe ? "you" : selectedPerson?.name;
  const selectedRelationship = relationship === "Other" ? otherRelationship.trim() : relationship;
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  function searchAccounts() {
    setSearchError("");
    setResults(null);
    setSelectedAccount("");
    startSearch(async () => {
      try {
        const response = await searchFamilyMomentMakers(searchName);
        setSearchError(response.error ?? "");
        setResults(response.error ? null : response.results);
      } catch (error) {
        console.error("[family-tree] Moment Maker search failed.", error);
        setSearchError("Search could not be completed. Please try again.");
      }
    });
  }

  if (state.success) {
    return (
      <div role="status" className="space-y-4 text-sm text-[color:var(--nsg-accent-light)]">
        <p>{state.success}</p>
        {state.treeId && <a href={`#legacy-tree-item-${encodeURIComponent(state.treeId)}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">View My Tree</a>}
        <p><button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Add another family member</button></p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" onSubmit={(event) => {
      if (step < 4 || (step === 4 && (!accountChoice || accountChoice === "placeholder" || (accountChoice === "existing" && !selectedAccount)))) event.preventDefault();
    }}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" aria-live="polite">
        Step {step} of 5
      </p>
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="relationshipTo" value={reference} />
      <input type="hidden" name="relationship" value={selectedRelationship} />
      <input type="hidden" name="name" value={fullName} />
      <input type="hidden" name="memberType" value={accountChoice ?? ""} />
      {accountChoice === "existing" && <input type="hidden" name="existingUserId" value={selectedAccount} />}

      {step === 1 && (
        <fieldset>
          <legend className="font-serif text-xl text-white">Who is this person related to?</legend>
          {trees.length > 1 && (
            <label className="mt-4 block text-sm text-slate-300">
              Choose a Legacy Tree™
              <select value={treeId} className={fieldClassName} onChange={(event) => {
                const tree = trees.find((item) => item.id === event.target.value);
                if (tree) {
                  setTreeId(tree.id);
                  setReference(meInTree(tree, userId));
                }
              }}>
                {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
              </select>
            </label>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {people.map((person) => (
              <button key={person.value} type="button" aria-pressed={reference === person.value}
                className={choiceClassName} onClick={() => setReference(person.value)}>
                {person.isMe ? "Me" : person.isPartner ? `My Spouse / Partner · ${person.name}` : person.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset>
          <legend className="font-serif text-xl text-white">How is this person related to {relativeName}?</legend>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {relationships.map((item) => (
              <button key={item} type="button" aria-pressed={relationship === item}
                className={choiceClassName} onClick={() => setRelationship(item)}>{item}</button>
            ))}
          </div>
          {relationship === "Other" && (
            <label className="mt-4 block text-sm text-slate-300">
              Describe their relationship
              <input value={otherRelationship} maxLength={80} onChange={(event) => setOtherRelationship(event.target.value)} className={fieldClassName} />
            </label>
          )}
          {selectedRelationship && !positionRelationship(selectedRelationship) && (
            <p className="mt-3 text-sm text-slate-400">This relationship will remain visible for review in the tree.</p>
          )}
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className="space-y-4">
          <legend className="font-serif text-xl text-white">What is their name?</legend>
          <label className="block text-sm text-slate-300">First Name
            <input value={firstName} maxLength={120} autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} className={fieldClassName} />
          </label>
          <label className="block text-sm text-slate-300">Last Name
            <input value={lastName} maxLength={120} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} className={fieldClassName} />
          </label>
          {fullName.length > 120 && <p role="alert" className="text-sm text-rose-300">The full name must be 120 characters or fewer.</p>}
        </fieldset>
      )}

      {step === 4 && (
        <fieldset>
          <legend className="font-serif text-xl text-white">Do they already have a Never Say Goodbye™ account?</legend>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" aria-pressed={accountChoice === "existing"} className={choiceClassName} onClick={() => setAccountChoice("existing")}>Yes</button>
            <button type="button" aria-pressed={accountChoice === "placeholder"} className={choiceClassName} onClick={() => setAccountChoice("placeholder")}>No</button>
          </div>
          {accountChoice === "existing" && (
            <div className="mt-5 space-y-3">
              <label className="block text-sm text-slate-300">Find their Moment Maker™ account
                <input value={searchName} maxLength={100} disabled={searching} onChange={(event) => {
                  setSearchName(event.target.value);
                  setResults(null);
                  setSelectedAccount("");
                }} className={fieldClassName} />
              </label>
              <button type="button" disabled={searching || !searchName.trim()} onClick={searchAccounts} className={buttonClassName}>
                {searching ? "Searching…" : "Search"}
              </button>
              {searchError && <p role="alert" className="text-sm text-rose-300">{searchError}</p>}
              {results && results.length === 0 && <p className="text-sm text-slate-400">No searchable accounts found. Try another name.</p>}
              {results && results.length > 0 && (
                <div className="grid gap-2">
                  {results.map((result) => (
                    <button key={result.id} type="button" aria-pressed={selectedAccount === result.id}
                      className={choiceClassName} onClick={() => setSelectedAccount(result.id)}>{result.displayName}</button>
                  ))}
                </div>
              )}
              <p className="text-xs leading-5 text-slate-400">Adding them to this tree does not create a Connected Lives™ connection or share dates.</p>
            </div>
          )}
          {accountChoice === "placeholder" && (
            <p className="mt-4 text-sm text-slate-400">They won&apos;t need an account or receive notifications.</p>
          )}
          <button type="button" onClick={() => setAccountChoice("future")} className="mt-4 min-h-11 text-left text-sm text-[color:var(--nsg-accent-light)] underline underline-offset-4">
            Add a Future Moment Maker™ instead
          </button>
          {accountChoice === "future" && <p className="text-sm text-slate-400">Create a Future Moment Maker™ for this person.</p>}
        </fieldset>
      )}

      {step === 5 && (
        <fieldset className="space-y-4">
          <legend className="font-serif text-xl text-white">Add More Information <span className="text-sm text-slate-400">(Optional)</span></legend>
          <label className="block text-sm text-slate-300">Birth Year
            <input type="number" name="birthYear" min="1000" max="9999" step="1" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} className={fieldClassName} />
          </label>
          <label className="block text-sm text-slate-300">Death Year
            <input type="number" name="deathYear" min="1000" max="9999" step="1" value={deathYear} onChange={(event) => setDeathYear(event.target.value)} className={fieldClassName} />
          </label>
          <label className="block text-sm text-slate-300">Notes
            <textarea name="notes" maxLength={1000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${fieldClassName} py-3`} />
          </label>
        </fieldset>
      )}

      {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        {step > 1 && <button type="button" disabled={isPending || searching} className={choiceClassName} onClick={() => setStep(step - 1)}>Back</button>}
        {step < 4 && (
          <button type="button" className={buttonClassName}
            disabled={step === 1 ? !selectedPerson : step === 2 ? !selectedRelationship : !firstName.trim() || !lastName.trim() || fullName.length > 120}
            onClick={() => {
              if (step === 3) {
                setSearchName(fullName);
                setResults(null);
                setSelectedAccount("");
                setSearchError("");
              }
              setStep(step + 1);
            }}>Continue</button>
        )}
        {step === 4 && accountChoice === "placeholder" && <button type="button" className={buttonClassName} onClick={() => setStep(5)}>Continue</button>}
        {step === 4 && (accountChoice === "existing" || accountChoice === "future") && (
          <button type="submit" className={buttonClassName} disabled={isPending || (accountChoice === "existing" && !selectedAccount)}>
            {isPending ? "Adding…" : "Add Family Member"}
          </button>
        )}
        {step === 5 && (
          <>
            <button type="submit" className={buttonClassName} disabled={isPending}>{isPending ? "Adding…" : "Add Family Member"}</button>
            <button type="submit" name="skipDetails" value="yes" formNoValidate className={choiceClassName} disabled={isPending}>Skip and Add</button>
          </>
        )}
      </div>
    </form>
  );
}
