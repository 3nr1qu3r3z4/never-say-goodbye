import Link from "next/link";
import { createLegacyTree } from "@/app/actions/family-tree";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import FamilyMemberForm from "./family-member-form";

type FamilyTree = { id: string; name: string };
type MomentMaker = { id: string; displayName: string };
type TreeMember = {
  id: string;
  treeId: string;
  displayName: string;
  relationship: string;
};
type FutureMomentMaker = {
  id: string;
  treeId: string;
  name: string;
  relationship: string;
  status: string;
};
type FamilyPlaceholder = {
  id: string;
  treeId: string;
  name: string;
  relationship: string;
  birthYear: number | null;
  deathYear: number | null;
  notes: string | null;
};
type LinkedMoment = {
  id: string;
  familyPlaceholderId: string;
  title: string;
  story: string | null;
  writtenMessage: string | null;
  restricted: boolean;
};

const cardClassName =
  "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6";
const buttonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]";

function EmptyLegacyTree({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-8">
      <div className={`${cardClassName} border-[#D8A35B]/25`}>
        <h2 className="font-serif text-2xl text-white sm:text-3xl">
          Your Legacy Tree is waiting to be built.
        </h2>
        <p className="mt-4 leading-7 text-slate-400">
          Connect family members, add Future Moment Makers™, and preserve family history.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {signedIn ? (
            <form action={createLegacyTree}>
              <button type="submit" className={buttonClassName}>Create My Legacy Tree</button>
            </form>
          ) : (
            <Link href="/signup" className={buttonClassName}>Create My Legacy Tree</Link>
          )}
          <Link href={signedIn ? "/connected-lives" : "/login"} className={buttonClassName}>
            Connect Family
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function FamilyMembers() {
  const user = await getCurrentUser();
  if (!user) return <EmptyLegacyTree signedIn={false} />;
  return <FamilyMembersForUser userId={user.id} />;
}

async function FamilyMembersForUser({ userId }: { userId: string }) {
  const sql = getSql();
  const [trees, momentMakers, members, futureMakers, placeholders, linkedMoments] =
    await sql.transaction([
      sql`
        SELECT lt.id, lt.name
        FROM legacy_trees AS lt
        JOIN legacy_tree_members AS ltm ON ltm.tree_id = lt.id
        WHERE ltm.user_id = ${userId}
        ORDER BY lt.created_at, lt.id
      `,
      sql`
        SELECT id, display_name AS "displayName"
        FROM users
        WHERE id <> ${userId}
          AND discoverability IN ('searchable', 'public')
        ORDER BY display_name
        LIMIT 100
      `,
      sql`
        SELECT u.id, ltm.tree_id AS "treeId", u.display_name AS "displayName",
               ltm.relationship AS relationship
        FROM legacy_tree_members AS ltm
        JOIN legacy_trees AS lt ON lt.id = ltm.tree_id
        JOIN users AS u ON u.id = ltm.user_id
        WHERE lt.id IN (
          SELECT tree_id FROM legacy_tree_members WHERE user_id = ${userId}
        )
        ORDER BY u.display_name
      `,
      sql`
        SELECT fmm.id, fmm.legacy_tree_id AS "treeId", fmm.name, fmm.relationship, fmm.status
        FROM future_moment_makers AS fmm
        WHERE fmm.legacy_tree_id IN (
          SELECT tree_id FROM legacy_tree_members WHERE user_id = ${userId}
        )
          AND fmm.status <> 'archived'
        ORDER BY fmm.created_at DESC
      `,
      sql`
        SELECT fp.id, fp.legacy_tree_id AS "treeId", fp.name, fp.relationship,
               fp.birth_year AS "birthYear", fp.death_year AS "deathYear",
               fp.notes
        FROM family_placeholders AS fp
        WHERE fp.legacy_tree_id IN (
          SELECT tree_id FROM legacy_tree_members WHERE user_id = ${userId}
        )
        ORDER BY fp.created_at DESC
      `,
      sql`
        SELECT id, family_placeholder_id AS "familyPlaceholderId",
               title,
               access_code_hash IS NOT NULL OR kind = 'cannot-open-until' AS restricted,
               CASE WHEN access_code_hash IS NULL AND kind <> 'cannot-open-until'
                 THEN story END AS story,
               CASE WHEN access_code_hash IS NULL AND kind <> 'cannot-open-until'
                 THEN details_json::jsonb ->> 'writtenMessage' END AS "writtenMessage"
        FROM moments
        WHERE user_id = ${userId}
          AND family_placeholder_id IS NOT NULL
        ORDER BY created_at DESC
      `,
    ]);

  const treeRows = trees as FamilyTree[];
  if (!treeRows.length) return <EmptyLegacyTree signedIn />;

  const memberRows = members as TreeMember[];
  const futureRows = futureMakers as FutureMomentMaker[];
  const placeholderRows = placeholders as FamilyPlaceholder[];
  const momentRows = linkedMoments as LinkedMoment[];
  const momentsByPlaceholder = new Map<string, LinkedMoment[]>();
  for (const moment of momentRows) {
    const linked = momentsByPlaceholder.get(moment.familyPlaceholderId) ?? [];
    linked.push(moment);
    momentsByPlaceholder.set(moment.familyPlaceholderId, linked);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-20 sm:px-8">
      {treeRows.map((tree) => {
        const treeMembers = memberRows.filter((member) => member.treeId === tree.id);
        const treeFutureMakers = futureRows.filter((member) => member.treeId === tree.id);
        const treePlaceholders = placeholderRows.filter((member) => member.treeId === tree.id);
        return (
          <section key={tree.id} aria-label={tree.name}>
            <h2 className="font-serif text-2xl text-white sm:text-3xl">{tree.name}</h2>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              People in Your Tree
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {treeMembers.map((member) => (
                <li key={`member-${member.treeId}-${member.id}`} className={cardClassName}>
                  <span className="inline-flex rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-300">
                    Moment Maker™
                  </span>
                  <p className="mt-3 font-serif text-lg text-white">{member.displayName}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {member.id === userId ? "You" : member.relationship || "Family Member"}
                  </p>
                </li>
              ))}
              {treeFutureMakers.map((member) => (
                <li key={`future-${member.id}`} className={cardClassName}>
                  <span className="inline-flex rounded-full border border-[#D8A35B]/30 px-3 py-1 text-xs font-semibold text-[#f0c98e]">
                    Future Moment Maker™
                  </span>
                  <p className="mt-3 font-serif text-lg text-white">{member.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{member.relationship}</p>
                  <p className="mt-2 text-xs text-[#f0c98e]">
                    {member.status === "claimed" ? "Claimed" : "Awaiting Claim"}
                  </p>
                </li>
              ))}
              {treePlaceholders.map((member) => (
                <li key={`placeholder-${member.id}`} className={cardClassName}>
                  <span className="inline-flex rounded-full border border-[#D8A35B]/30 px-3 py-1 text-xs font-semibold text-[#f0c98e]">
                    Family Placeholder
                  </span>
                  <p className="mt-3 font-serif text-lg text-white">{member.name}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {member.relationship}
                    {member.birthYear || member.deathYear
                      ? ` · ${member.birthYear ?? "?"}–${member.deathYear ?? "?"}` : ""}
                  </p>
                  {member.notes && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{member.notes}</p>
                  )}
                  {(momentsByPlaceholder.get(member.id)?.length ?? 0) > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Your linked moments</p>
                      <ul className="mt-2 space-y-3">
                        {momentsByPlaceholder.get(member.id)?.map((moment) => (
                          <li key={moment.id}>
                            <p className="font-serif text-sm text-white">{moment.title}</p>
                            {moment.story && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-slate-400">{moment.story}</p>}
                            {moment.writtenMessage && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-slate-400">{moment.writtenMessage}</p>}
                            {moment.restricted && <p className="mt-1 text-xs text-slate-400">Protected or scheduled content is not shown here.</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Link a written moment to this person when publishing. Only your own linked moments appear here.
                  </p>
                  <Link href="/create-moment" className="mt-2 inline-block text-xs font-medium text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4 hover:text-white">
                    Create a moment
                  </Link>
                </li>
              ))}
            </ul>
            {treeMembers.every((member) => member.id === userId) && !treeFutureMakers.length && !treePlaceholders.length && (
              <p className="mt-4 text-sm text-slate-400">Add family members to begin building this tree.</p>
            )}
          </section>
        );
      })}

      <section id="family-members" aria-labelledby="family-members-heading">
        <h2 id="family-members-heading" className="font-serif text-2xl text-white sm:text-3xl">Add Family Member</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Add an existing Moment Maker™, reserve a place for a Future Moment Maker™, or preserve a relative who will never have an account.
        </p>
        <div className={`${cardClassName} mt-5 border-[#D8A35B]/25`}>
          <FamilyMemberForm trees={treeRows} momentMakers={momentMakers as MomentMaker[]} />
        </div>
      </section>
    </div>
  );
}
