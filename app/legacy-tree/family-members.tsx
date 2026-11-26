import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import { createLegacyTree } from "@/app/actions/family-tree";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { orderTreePeople, positionRelationship, treeReferenceKey } from "@/lib/tree-positioning";
import FamilyMemberForm from "./family-member-form";
import TreeMilestonesPanel from "./tree-milestones-panel";

type FamilyTree = { id: string; name: string; ownerId: string; ownerName: string };
type FamilyLine = { linePartnerType: string | null; linePartnerId: string | null };
type TreeMember = FamilyLine & {
  id: string;
  treeId: string;
  displayName: string;
  relationship: string;
  role: string;
  allowAdmin: boolean;
};
type FutureMomentMaker = FamilyLine & {
  id: string;
  treeId: string;
  name: string;
  relationship: string;
  status: string;
};
type FamilyPlaceholder = FamilyLine & {
  id: string;
  treeId: string;
  name: string;
  relationship: string;
  birthYear: number | null;
  deathYear: number | null;
  notes: string | null;
  isHonored: boolean;
  birthDate: string | null;
  passingDate: string | null;
  shortStory: string | null;
  profilePhoto: string | null;
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
  "min-w-0 break-words rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 sm:p-6";
const buttonClassName =
  "inline-flex min-h-12 min-w-0 max-w-full items-center justify-center break-words rounded-full border border-[color:var(--nsg-accent)]/60 px-6 py-3 text-center text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:border-[color:var(--nsg-accent)] hover:bg-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]";

function EmptyLegacyTree({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-8">
      <div className={`${cardClassName} border-[color:var(--nsg-accent)]/25`}>
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
  const [trees, members, futureMakers, placeholders, linkedMoments] =
    await sql.transaction([
      sql`
        SELECT lt.id, lt.name, lt.owner_user_id AS "ownerId", owner.display_name AS "ownerName"
        FROM legacy_trees AS lt
        JOIN legacy_tree_members AS ltm ON ltm.tree_id = lt.id
        JOIN users AS owner ON owner.id = lt.owner_user_id
        WHERE ltm.user_id = ${userId}
        ORDER BY lt.created_at, lt.id
      `,
      sql`
        SELECT u.id, ltm.tree_id AS "treeId", u.display_name AS "displayName",
               ltm.relationship AS relationship, ltm.role, ltm.allow_milestone_admin AS "allowAdmin",
               ltm.line_partner_type AS "linePartnerType", ltm.line_partner_id AS "linePartnerId"
        FROM legacy_tree_members AS ltm
        JOIN legacy_trees AS lt ON lt.id = ltm.tree_id
        JOIN users AS u ON u.id = ltm.user_id
        WHERE lt.id IN (
          SELECT tree_id FROM legacy_tree_members WHERE user_id = ${userId}
        )
        ORDER BY u.display_name
      `,
      sql`
        SELECT fmm.id, fmm.legacy_tree_id AS "treeId", fmm.name, fmm.relationship, fmm.status,
               fmm.line_partner_type AS "linePartnerType", fmm.line_partner_id AS "linePartnerId"
        FROM future_moment_makers AS fmm
        WHERE fmm.legacy_tree_id IN (
          SELECT tree_id FROM legacy_tree_members WHERE user_id = ${userId}
        )
          AND fmm.status <> 'archived'
        ORDER BY fmm.created_at DESC
      `,
      sql`
        SELECT fp.id, fp.legacy_tree_id AS "treeId", fp.name, fp.relationship,
               fp.line_partner_type AS "linePartnerType", fp.line_partner_id AS "linePartnerId",
               fp.birth_year AS "birthYear", fp.death_year AS "deathYear",
               fp.notes, (honored.family_placeholder_id IS NOT NULL) AS "isHonored",
               fp.birth_date::text AS "birthDate", honored.passing_date::text AS "passingDate",
               honored.short_story AS "shortStory", honored.profile_photo_data AS "profilePhoto"
        FROM family_placeholders AS fp
        LEFT JOIN honored_lives AS honored ON honored.family_placeholder_id = fp.id
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
  const treeOptions = treeRows.map((tree) => ({
    ...tree,
    people: [
      ...memberRows.filter((member) => member.treeId === tree.id && member.id !== tree.ownerId).map((member) => ({
        type: "member", id: member.id, name: member.displayName,
        isPartner: !member.linePartnerType && Boolean(positionRelationship(member.relationship)?.partner),
      })),
      ...futureRows.filter((member) => member.treeId === tree.id).map((member) => ({
        type: "future", id: member.id, name: member.name,
        isPartner: !member.linePartnerType && Boolean(positionRelationship(member.relationship)?.partner),
      })),
      ...placeholderRows.filter((member) => member.treeId === tree.id).map((member) => ({
        type: "placeholder", id: member.id, name: member.name,
        isPartner: !member.linePartnerType && Boolean(positionRelationship(member.relationship)?.partner),
      })),
    ],
  }));
  const momentsByPlaceholder = new Map<string, LinkedMoment[]>();
  for (const moment of momentRows) {
    const linked = momentsByPlaceholder.get(moment.familyPlaceholderId) ?? [];
    linked.push(moment);
    momentsByPlaceholder.set(moment.familyPlaceholderId, linked);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-20 sm:px-8">
      <nav aria-label="Legacy Tree navigation" className="flex flex-wrap gap-3">
        <a href="#family-members" className={buttonClassName}>Add Family Member</a>
      </nav>
      <div id="tree-map" className="scroll-mt-6 space-y-12">
        {treeRows.length > 1 && (
          <nav aria-label="Choose a tree to view">
            <p className="text-sm font-semibold text-slate-300">Choose a tree to view</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {treeRows.map((tree) => (
                <li key={tree.id} className="min-w-0 max-w-full">
                  <a href={`#legacy-tree-item-${encodeURIComponent(tree.id)}`} className={buttonClassName}>{tree.name}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {treeRows.map((tree) => {
          const treeMembers = memberRows.filter((member) => member.treeId === tree.id);
          const treeFutureMakers = futureRows.filter((member) => member.treeId === tree.id);
          const treePlaceholders = placeholderRows.filter((member) => member.treeId === tree.id);
          const ownMembership = treeMembers.find((member) => member.id === userId);
          const isAdmin = ownMembership?.role === "owner" || ownMembership?.role === "admin";
          const owner = treeMembers.find((member) => member.id === tree.ownerId) ?? {
            id: tree.ownerId, treeId: tree.id, displayName: tree.ownerName,
            relationship: "", role: "owner", allowAdmin: false, linePartnerType: null, linePartnerId: null,
          };
          const layout = orderTreePeople([
            ...[owner, ...treeMembers.filter((member) => member.id !== tree.ownerId)].map((member) => ({
              kind: "member" as const, data: member, name: member.displayName,
              relationship: member.relationship, isOwner: member.id === tree.ownerId,
            })),
            ...treeFutureMakers.map((member) => ({
              kind: "future" as const, data: member, name: member.name,
              relationship: member.relationship, isOwner: false,
            })),
            ...treePlaceholders.map((member) => ({
              kind: "placeholder" as const, data: member, name: member.name,
              relationship: member.relationship, isOwner: false,
            })),
          ]);
          const household = layout.generations.find((group) => group.generation === 0)?.members.filter((person) => person.isOwner || !treeReferenceKey(person)) ?? [];
          const ownerIndex = household.findIndex((person) => person.isOwner);
          const partners = household.filter((person) => !person.isOwner && positionRelationship(person.relationship)?.partner);
          const hasHouseholdConnector = partners.length === 1 && ownerIndex >= 0 &&
            household[ownerIndex + 1] === partners[0];
          const hasChildren = layout.generations.some((group) => group.generation === -1 && group.members.some((person) => !treeReferenceKey(person)));
          const leftCount = hasHouseholdConnector ? ownerIndex : 0;
          const rightCount = hasHouseholdConnector ? household.length - ownerIndex - 2 : 0;
          const namesByPerson = new Map<string, string>([
            ...treeMembers.map((member) => [`member:${member.id}`, member.displayName] as const),
            ...treeFutureMakers.map((member) => [`future:${member.id}`, member.name] as const),
            ...treePlaceholders.map((member) => [`placeholder:${member.id}`, member.name] as const),
          ]);
          const people = [
            ...treeMembers.map((member) => ({
              id: member.id, type: "user" as const, name: member.displayName,
              canEdit: member.id === userId || Boolean(isAdmin && member.allowAdmin),
            })),
            ...treePlaceholders.map((member) => ({
              id: member.id, type: "placeholder" as const, name: member.name, canEdit: isAdmin,
            })),
            ...treeFutureMakers.filter((member) => member.status !== "archived").map((member) => ({
              id: member.id, type: "future" as const, name: member.name, canEdit: isAdmin,
            })),
          ];
          return (
            <section key={tree.id} id={`legacy-tree-item-${tree.id}`} aria-label={tree.name} className="scroll-mt-6">
              <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--nsg-accent)]/50 bg-[color:var(--nsg-accent)]/[0.08] px-5 py-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--nsg-accent-light)]">Legacy Tree™</p>
                <h2 className="mt-2 break-words font-serif text-2xl text-white sm:text-3xl">{tree.name}</h2>
              </div>
              <div aria-hidden="true" className="mx-auto h-8 w-px bg-[color:var(--nsg-accent)]/50" />
              <div className="rounded-3xl border border-[color:var(--nsg-accent)]/25 bg-slate-950/20 p-4 sm:p-6">
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Family generations">
                  <div className="w-max min-w-full">
                    {layout.generations.map(({ generation, members }, index) => {
                      const ownerGroup = generation <= 0 ? members.filter((person) => person.isOwner || !treeReferenceKey(person)) : [];
                      const relativeGroups = new Map<string, { reference: string | null; label: string; people: typeof members }>();
                      for (const person of members) {
                        if (ownerGroup.includes(person)) continue;
                        const reference = treeReferenceKey(person);
                        const position = positionRelationship(person.relationship);
                        const label = position?.generation === 2 ? "Grandparents" : position?.generation === 1 ? "Parents" :
                          position?.generation === -1 ? "Children" : position?.generation === -2 ? "Grandchildren" :
                          position?.partner ? "Partner" : "Siblings";
                        const key = JSON.stringify([reference, label]);
                        const group = relativeGroups.get(key) ?? { reference, label, people: [] };
                        group.people.push(person);
                        relativeGroups.set(key, group);
                      }
                      const renderRelativeGroups = () => relativeGroups.size > 0 && (
                        <div className="mx-auto mt-4 flex w-max items-start gap-6">
                          {Array.from(relativeGroups.entries()).sort(([a, first], [b, second]) =>
                            Number(Boolean(first.reference)) - Number(Boolean(second.reference)) || a.localeCompare(b)
                          ).map(([key, group]) => (
                            <div key={key}>
                              <h3 className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                {group.reference ? `${namesByPerson.get(group.reference) ?? "Family member"}'s` : `${tree.ownerName}'s`} {group.label}
                              </h3>
                              <ul className="mt-3 flex w-max gap-3">
                                {group.people.map((person) => renderPerson(person, false))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      );
                      const renderOwnerGroup = () => ownerGroup.length > 0 && (
                          <>
                            <h3 className={`${generation === -1 && hasHouseholdConnector ? "" : "mt-4 "}text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400`}>
                              {generation === 0 ? "Your household" : generation === -1 ? "Children" : "Grandchildren"}
                            </h3>
                            {generation === -1 && hasHouseholdConnector && <div aria-hidden="true" className="mx-auto h-3 w-px bg-[color:var(--nsg-accent)]/40" />}
                            <ul className={`mx-auto ${generation === -1 && hasHouseholdConnector ? "" : "mt-3 "}flex w-max gap-3`}>
                              {generation === 0 && hasHouseholdConnector && Array.from({ length: Math.max(0, rightCount - leftCount) }, (_, i) => (
                                <li key={`left-spacer-${i}`} aria-hidden="true" className="w-40 shrink-0 sm:w-56" />
                              ))}
                              {ownerGroup.map((person, memberIndex) => (
                                <Fragment key={`${person.kind}-${person.data.id}`}>
                                  {generation === 0 && hasHouseholdConnector && memberIndex === ownerIndex + 1 && (
                                    <li data-tree-connector="household" aria-hidden="true" className="relative w-0 shrink-0">
                                      <span className="absolute -left-3 -right-3 top-1/2 h-px bg-[color:var(--nsg-accent)]/40" />
                                      {hasChildren && <span data-tree-connector="children" className="absolute bottom-0 left-0 top-1/2 w-px bg-[color:var(--nsg-accent)]/40" />}
                                    </li>
                                  )}
                                  {renderPerson(person, false)}
                                </Fragment>
                              ))}
                              {generation === 0 && hasHouseholdConnector && Array.from({ length: Math.max(0, leftCount - rightCount) }, (_, i) => (
                                <li key={`right-spacer-${i}`} aria-hidden="true" className="w-40 shrink-0 sm:w-56" />
                              ))}
                            </ul>
                          </>
                      );
                      return (
                        <div key={generation}>
                          {index > 0 && <div aria-hidden="true" className="mx-auto h-6 w-px bg-[color:var(--nsg-accent)]/40" />}
                          {generation === 0 && relativeGroups.size > 0 ? (
                            <div className="grid w-max min-w-full grid-cols-[1fr_auto_1fr] items-end">
                              <div>{renderRelativeGroups()}</div>
                              <div>{renderOwnerGroup()}</div>
                              <div aria-hidden="true" />
                            </div>
                          ) : (
                            <>
                              {renderOwnerGroup()}
                              {renderRelativeGroups()}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {layout.unpositioned.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-center text-sm font-semibold text-slate-300">Relationships to review</h3>
                    <p className="mt-2 text-center text-sm text-slate-400">These labels could not be positioned confidently. Everyone remains visible here.</p>
                    <ul className="mt-3 flex flex-wrap justify-center gap-3">
                      {layout.unpositioned.map((person) => renderPerson(person, true))}
                    </ul>
                  </div>
                )}
                {treeMembers.every((member) => member.id === userId) && !treeFutureMakers.length && !treePlaceholders.length && (
                  <p className="mt-4 text-sm text-slate-400">Add family members to begin building this tree.</p>
                )}
              </div>
              <TreeMilestonesPanel treeId={tree.id} userId={userId} people={people} isAdmin={isAdmin} allowAdmin={ownMembership?.allowAdmin ?? false} />
            </section>
          );

          function renderPerson(person: (typeof layout.generations)[number]["members"][number], needsReview: boolean) {
            const reference = treeReferenceKey(person);
            const relativeNotice = reference && (
              <p className="mt-1 text-xs text-slate-400">
                Relationship to {namesByPerson.get(reference) ?? "an unavailable family member"}
              </p>
            );
            const autoNotice = !person.isOwner && !needsReview && (
              <p className="mt-1 text-xs text-slate-400">Auto Placed</p>
            );
            const reviewNotice = !person.isOwner && needsReview && (
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Relationship needs review.
              </p>
            );
            if (person.kind === "member") {
              const member = person.data;
              return (
                    <li key={`member-${member.treeId}-${member.id}`} className={`${cardClassName} w-40 shrink-0 sm:w-56`}>
                      <span className="inline-flex rounded-full border border-[color:var(--nsg-border)]/15 px-3 py-1 text-xs font-semibold text-slate-300">
                        Moment Maker™
                      </span>
                      <p className="mt-3 font-serif text-lg text-white">{member.displayName}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {person.isOwner ? (member.id === userId ? "Tree owner · You" : "Tree owner") : member.id === userId ? `You · ${member.relationship || "Family Member"}` : member.relationship || "Family Member"}
                      </p>
                      {autoNotice}
                      {relativeNotice}
                      {reviewNotice}
                    </li>
              );
            }
            if (person.kind === "future") {
              const member = person.data;
              return (
                    <li key={`future-${member.id}`} className={`${cardClassName} w-40 shrink-0 sm:w-56`}>
                      <span className="inline-flex rounded-full border border-[color:var(--nsg-accent)]/30 px-3 py-1 text-xs font-semibold text-[color:var(--nsg-accent-light)]">
                        Future Moment Maker™
                      </span>
                      <p className="mt-3 font-serif text-lg text-white">{member.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{member.relationship}</p>
                      {autoNotice}
                      {relativeNotice}
                      <p className="mt-2 text-xs text-[color:var(--nsg-accent-light)]">
                        {member.status === "claimed" ? "Claimed" : "Awaiting Claim"}
                      </p>
                      {reviewNotice}
                    </li>
              );
            }
            const member = person.data;
            return (
                    <li key={`placeholder-${member.id}`} className={`${cardClassName} w-40 shrink-0 sm:w-56`}>
                      <span className="inline-flex rounded-full border border-[color:var(--nsg-accent)]/30 px-3 py-1 text-xs font-semibold text-[color:var(--nsg-accent-light)]">
                        {member.isHonored ? "🕊 Honored Life™" : "Family Placeholder"}
                      </span>
                      {member.isHonored && member.profilePhoto && (
                        <Image src={member.profilePhoto} alt="" width={96} height={96} unoptimized className="mt-4 h-24 w-24 rounded-full object-cover" />
                      )}
                      <p className="mt-3 font-serif text-lg text-white">{member.name}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {member.relationship}
                        {member.birthYear || member.deathYear
                          ? ` · ${member.birthYear ?? "?"}–${member.deathYear ?? "?"}` : ""}
                      </p>
                      {autoNotice}
                      {relativeNotice}
                      {member.isHonored && (member.birthDate || member.passingDate) && (
                        <p className="mt-2 text-sm text-slate-400">
                          {member.birthDate && `Born: ${member.birthDate}`}
                          {member.birthDate && member.passingDate && " · "}
                          {member.passingDate && `Passed: ${member.passingDate}`}
                        </p>
                      )}
                      {member.isHonored && member.shortStory && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{member.shortStory}</p>
                      )}
                      {member.notes && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{member.notes}</p>
                      )}
                      {(momentsByPlaceholder.get(member.id)?.length ?? 0) > 0 && (
                        <div className="mt-4 border-t border-[color:var(--nsg-border)]/10 pt-4">
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
                      <Link href="/create-moment" className="mt-2 inline-block text-xs font-medium text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white">
                        Create a moment
                      </Link>
                      {reviewNotice}
                    </li>
            );
          }
        })}
      </div>

      <section id="family-members" aria-labelledby="family-members-heading">
        <h2 id="family-members-heading" className="font-serif text-2xl text-white sm:text-3xl">Add Family Member</h2>
        <div className={`${cardClassName} mt-5 border-[color:var(--nsg-accent)]/25`}>
          <FamilyMemberForm trees={treeOptions} userId={userId} />
        </div>
      </section>
    </div>
  );
}
