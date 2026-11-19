import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { relationshipForViewer } from "@/lib/connected-lives";
import type { DirectoryConnection, PersonTag } from "@/lib/connected-lives-directory";
import { markLivesNotificationsRead } from "@/app/actions/connected-lives";
import ConnectionResponse from "./connection-response";
import ConnectedLivesDirectory from "./directory";

export const metadata: Metadata = {
  title: "Connected Lives™ | Never Say Goodbye",
  description: "Manage your meaningful Moment Maker connections.",
};
export const instant = false;

type Connection = {
  id: string;
  status: "pending" | "accepted" | "declined";
  requesterId: string;
  recipientId: string | null;
  displayName: string;
  relationshipType: string | null;
  relationshipSubjectId: string | null;
  personId: string | null;
  acceptedAt: string | null;
  profilePhoto: string | null;
  profileVisible: boolean;
  birthYear: number | null;
  personTags: PersonTag[];
  ownTags: PersonTag[];
  createdAt: string;
};

type FutureMaker = {
  id: string;
  name: string;
  relationship: string;
  status: string;
};

type LivesNotification = {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export default async function ConnectedLivesPage() {
  const user = await requireUser();
  const sql = getSql();
  const [connectionRows, notificationRows, futureRows] = await Promise.all([
    sql`
      SELECT cl.id, cl.status,
             cl.owner_user_id AS "requesterId",
             cl.connected_user_id AS "recipientId",
             CASE
               WHEN cl.owner_user_id = ${user.id}
                 THEN COALESCE(NULLIF(BTRIM(recipient.display_name), ''), cl.display_name)
               ELSE COALESCE(NULLIF(BTRIM(requester.display_name), ''), cl.display_name)
             END AS "displayName",
             cl.relationship_type AS "relationshipType",
             cl.relationship_subject_user_id AS "relationshipSubjectId",
             person.id AS "personId",
             to_char(cl.accepted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "acceptedAt",
             (person.discoverability IN ('searchable', 'public')) IS TRUE AS "profileVisible",
             CASE WHEN person.public_profile_photo AND person.discoverability IN ('searchable', 'public')
               THEN NULLIF(person.profile_photo_data, '') ELSE NULL END AS "profilePhoto",
             CASE WHEN person.share_birthday AND EXISTS (
               SELECT 1 FROM legacy_tree_members viewer_tree
               JOIN legacy_tree_members person_tree ON person_tree.tree_id = viewer_tree.tree_id
               WHERE viewer_tree.user_id = ${user.id} AND person_tree.user_id = person.id
             ) THEN COALESCE(person.birth_year, EXTRACT(YEAR FROM person.birth_date)::int) ELSE NULL END AS "birthYear",
             COALESCE((SELECT json_agg(json_build_object('id', tag.id, 'label', tag.label) ORDER BY tag.label)
               FROM connected_lives_person_tags tag
               WHERE tag.connection_id = cl.id AND tag.subject_user_id = person.id), '[]'::json) AS "personTags",
             COALESCE((SELECT json_agg(json_build_object('id', tag.id, 'label', tag.label) ORDER BY tag.label)
               FROM connected_lives_person_tags tag
               WHERE tag.connection_id = cl.id AND tag.subject_user_id = ${user.id}), '[]'::json) AS "ownTags",
             cl.created_at AS "createdAt"
      FROM connected_lives AS cl
      LEFT JOIN users AS requester ON requester.id = cl.owner_user_id
      LEFT JOIN users AS recipient ON recipient.id = cl.connected_user_id
      LEFT JOIN users AS person ON person.id = CASE WHEN cl.owner_user_id = ${user.id}
        THEN cl.connected_user_id ELSE cl.owner_user_id END
      WHERE cl.owner_user_id = ${user.id}
         OR cl.connected_user_id = ${user.id}
      ORDER BY cl.updated_at DESC, cl.created_at DESC
    `,
    sql`
      SELECT id, type, message, read_at AS "readAt", created_at AS "createdAt"
      FROM notifications
      WHERE recipient_user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 20
    `,
    sql`
      SELECT id, name, relationship, status
      FROM future_moment_makers
      WHERE owner_user_id = ${user.id} AND status <> 'archived'
      ORDER BY name, id
    `,
  ]);
  const rows = connectionRows as Connection[];
  const notifications = notificationRows as LivesNotification[];

  const incoming = rows.filter(
    (connection) =>
      connection.status === "pending" &&
      connection.recipientId === user.id,
  );
  const sent = rows.filter(
    (connection) =>
      connection.status === "pending" &&
      connection.requesterId === user.id,
  );
  const connected = rows.filter(
    (connection) => connection.status === "accepted",
  ).map((connection): DirectoryConnection => ({
    id: connection.id,
    personId: connection.personId,
    displayName: connection.displayName,
    relationshipType: relationshipForViewer(connection.relationshipType, connection.relationshipSubjectId, user.id),
    acceptedAt: connection.acceptedAt,
    profilePhoto: connection.profilePhoto,
    profileVisible: connection.profileVisible,
    birthYear: connection.birthYear,
    personTags: connection.personTags,
    ownTags: connection.ownTags,
  }));
  const futureMakers = futureRows as FutureMaker[];
  const declined = rows.filter(
    (connection) => connection.status === "declined",
  );
  const cardClassName =
    "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6";

  return (
    <main className="min-h-screen bg-[#0F172A] px-6 py-12 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
          Meaningful relationships
        </p>
        <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">
          Connected Lives™
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          Explore the people and families connected to your life.
        </p>
        {notifications.some((notification) => !notification.readAt) && (
          <form action={markLivesNotificationsRead} className="mt-5">
            <button
              type="submit"
              className="min-h-11 rounded-full border border-[#D8A35B]/50 px-5 text-sm font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10"
            >
              Mark Notifications Read
            </button>
          </form>
        )}

        <ConnectedLivesDirectory connections={connected} viewerId={user.id} />

        <section className="mt-10" aria-labelledby="future-heading">
          <h2 id="future-heading" className="font-serif text-2xl text-white sm:text-3xl">Future Moment Makers™</h2>
          <p className="mt-3 text-sm text-slate-400">People whose stories are still unfolding, separate from your accepted connections.</p>
          {futureMakers.length ? <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {futureMakers.map((maker) => <li key={maker.id} className={cardClassName}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">Future Moment Maker™</p>
              <h3 className="mt-2 break-words font-serif text-xl text-white">{maker.name}</h3>
              <p className="mt-2 text-sm text-slate-300">{maker.relationship} · {maker.status === "awaiting-claim" ? "Awaiting Claim" : maker.status === "claimed" ? "Claimed" : maker.status}</p>
              <Link href={`/future-moment-maker/${encodeURIComponent(maker.id)}`} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[#D8A35B]/50 px-5 text-sm font-semibold text-[#f0c98e] hover:bg-[#D8A35B]/10">View Record</Link>
            </li>)}
          </ul> : <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">Future Moment Makers™ you create will appear here.</p>}
        </section>

        <section className="mt-10" aria-labelledby="requests-heading">
          <h2
            id="requests-heading"
            className="font-serif text-2xl text-white sm:text-3xl"
          >
            Connected Lives™ Requests
          </h2>
          {incoming.length ? (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {incoming.map((connection) => (
                <li key={connection.id} className={cardClassName}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                    ❤️ Connection request
                  </p>
                  <h3 className="mt-2 font-serif text-xl text-white">
                    {connection.displayName}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {connection.displayName} would like to connect with you.
                  </p>
                  <ConnectionResponse requestId={connection.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-400">
              You do not have any requests to review.
            </p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="activity-heading">
          <h2
            id="activity-heading"
            className="font-serif text-2xl text-white sm:text-3xl"
          >
            Lives Notifications
          </h2>
          {notifications.length ? (
            <ul className="mt-5 space-y-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`${cardClassName} ${notification.readAt ? "opacity-75" : "border-[#D8A35B]/30"}`}
                >
                  <p className="text-sm leading-6 text-slate-200">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {notification.type.replaceAll("_", " ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-400">
              Relationship activity will appear here.
            </p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="sent-heading">
          <h2
            id="sent-heading"
            className="font-serif text-2xl text-white sm:text-3xl"
          >
            Requests Sent
          </h2>
          {sent.length ? (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {sent.map((connection) => (
                <li key={connection.id} className={cardClassName}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Request Sent
                  </p>
                  <h3 className="mt-2 font-serif text-xl text-white">
                    {connection.displayName}
                  </h3>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-400">
              You have not sent any pending requests.
            </p>
          )}
        </section>

        {declined.length > 0 && (
          <section className="mt-10" aria-labelledby="past-heading">
            <h2 id="past-heading" className="font-serif text-2xl text-white">
              Past Requests
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {declined.map((connection) => (
                <li key={connection.id} className={cardClassName}>
                  <h3 className="font-serif text-lg text-white">
                    {connection.displayName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">Request declined</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          href="/search"
          className="mt-10 inline-flex min-h-12 items-center rounded-full border border-[#D8A35B]/60 px-6 font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10"
        >
          Find A Moment Maker
        </Link>
      </div>
    </main>
  );
}
