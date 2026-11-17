import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  relationshipTypes,
  type RelationshipType,
} from "@/lib/connected-lives";
import { markLivesNotificationsRead } from "@/app/actions/connected-lives";
import ConnectionResponse from "./connection-response";
import RelationshipEditor from "./relationship-editor";

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
  relationshipType: RelationshipType | null;
  createdAt: string;
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
  const [connectionRows, notificationRows] = await Promise.all([
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
             cl.created_at AS "createdAt"
      FROM connected_lives AS cl
      LEFT JOIN users AS requester ON requester.id = cl.owner_user_id
      LEFT JOIN users AS recipient ON recipient.id = cl.connected_user_id
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
  );
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
          Review relationship requests and other activity from the people and
          families connected to your life.
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

        <section className="mt-10" aria-labelledby="connections-heading">
          <h2
            id="connections-heading"
            className="font-serif text-2xl text-white sm:text-3xl"
          >
            Your Connections
          </h2>
          {connected.length ? (
            <div className="mt-5 space-y-8">
              {[
                ...relationshipTypes,
                { value: null, group: "Unclassified" },
              ].map((type) => {
                const connections = connected.filter(
                  (connection) => connection.relationshipType === type.value,
                );
                if (!connections.length) return null;
                return (
                  <section key={type.value ?? "unclassified"}>
                    <h3 className="font-serif text-xl text-white">
                      {type.group}
                    </h3>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                      {connections.map((connection) => (
                        <li key={connection.id} className={cardClassName}>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                            ❤️ Connected
                          </p>
                          <h4 className="mt-2 font-serif text-xl text-white">
                            {connection.displayName}
                          </h4>
                          <RelationshipEditor
                            connectionId={connection.id}
                            relationshipType={connection.relationshipType}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-400">
              Your accepted Connected Lives™ will appear here.
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
