"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isRelationshipType } from "@/lib/connected-lives";

export type ConnectionStatus = "none" | "sent" | "received" | "connected";
export type ConnectionActionResult = {
  status?: ConnectionStatus;
  message?: string;
  error?: string;
};

function refreshConnectionViews(profileUserId?: string) {
  revalidatePath("/connected-lives");
  revalidatePath("/dashboard");
  revalidatePath("/my-profile/preview");
  revalidatePath("/moment-maker/[id]", "page");
  if (profileUserId) revalidatePath(`/moment-maker/${profileUserId}`);
}

export async function sendConnectedLivesRequest(
  profileUserId: string,
): Promise<ConnectionActionResult> {
  const user = await requireUser();
  if (
    typeof profileUserId !== "string" ||
    profileUserId.length < 1 ||
    profileUserId.length > 200
  ) {
    return { error: "This Moment Maker profile could not be found." };
  }
  if (profileUserId === user.id) {
    return { error: "You cannot add your own profile to Connected Lives™." };
  }

  const sql = getSql();
  const [profile] = (await sql`
    SELECT display_name AS "displayName"
    FROM users
    WHERE id = ${profileUserId}
      AND discoverability IN ('searchable', 'public')
    LIMIT 1
  `) as { displayName: string }[];
  if (!profile) {
    return { error: "This Moment Maker is not available for a connection request." };
  }

  const now = new Date().toISOString();
  const connectionId = randomUUID();
  const notificationId = randomUUID();
  const pairKey = [user.id, profileUserId].sort().join(":");
  const rows = (await sql`
    WITH pair_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtext(${pairKey}))
    ),
    existing AS MATERIALIZED (
      SELECT id, status, owner_user_id AS "ownerUserId",
             connected_user_id AS "connectedUserId"
      FROM connected_lives, pair_lock
      WHERE (owner_user_id = ${user.id} AND connected_user_id = ${profileUserId})
         OR (owner_user_id = ${profileUserId} AND connected_user_id = ${user.id})
      ORDER BY (status = 'accepted') DESC, (status = 'pending') DESC
      LIMIT 1
    ),
    updated AS (
      UPDATE connected_lives
      SET owner_user_id = ${user.id},
          connected_user_id = ${profileUserId},
          display_name = ${profile.displayName},
          relationship = 'Connected Life',
          relationship_type = NULL,
          relationship_subject_user_id = NULL,
          accepted_at = NULL,
          status = 'pending',
          updated_at = ${now}
      WHERE id = (SELECT id FROM existing WHERE status = 'declined')
      RETURNING id
    ),
    inserted AS (
      INSERT INTO connected_lives (
        id, owner_user_id, connected_user_id, display_name, relationship,
        status, created_at, updated_at
      )
      SELECT ${connectionId}, ${user.id}, ${profileUserId},
             ${profile.displayName}, 'Connected Life', 'pending', ${now}, ${now}
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    ),
    created_request AS (
      SELECT id FROM updated
      UNION ALL
      SELECT id FROM inserted
    ),
    request_notification AS (
      INSERT INTO notifications (
        id, recipient_user_id, actor_user_id, type, related_entity_type,
        related_entity_id, message, created_at, updated_at
      )
      SELECT ${notificationId}, ${profileUserId}, ${user.id},
             'connected_lives_request', 'connected_lives', created_request.id,
             ${`${user.displayName} would like to connect with you.`},
             ${now}, ${now}
      FROM created_request
      ON CONFLICT (
        recipient_user_id, type, related_entity_type, related_entity_id
      )
      DO UPDATE SET
        actor_user_id = EXCLUDED.actor_user_id,
        message = EXCLUDED.message,
        read_at = NULL,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      RETURNING id
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM existing WHERE status = 'accepted')
        THEN 'connected'
      WHEN EXISTS (
        SELECT 1 FROM existing
        WHERE status = 'pending' AND "ownerUserId" = ${user.id}
      ) THEN 'sent'
      WHEN EXISTS (
        SELECT 1 FROM existing
        WHERE status = 'pending' AND "connectedUserId" = ${user.id}
      ) THEN 'received'
      WHEN EXISTS (SELECT 1 FROM updated) OR EXISTS (SELECT 1 FROM inserted)
        THEN 'sent'
      ELSE 'none'
    END AS status
  `) as { status: ConnectionStatus }[];

  const status = rows[0]?.status ?? "none";
  if (status === "sent") {
    refreshConnectionViews(profileUserId);
    return { status, message: "Connected Lives™ request sent." };
  }
  if (status === "connected") {
    return { status, message: "You are already connected." };
  }
  if (status === "received") {
    return {
      status,
      message: "This Moment Maker has already sent you a request.",
    };
  }
  return { error: "Your request could not be sent. Please try again." };
}

export async function respondToConnectedLivesRequest(
  _previousState: ConnectionActionResult,
  formData: FormData,
): Promise<ConnectionActionResult> {
  const user = await requireUser();
  const requestId = formData.get("requestId");
  const response = formData.get("response");
  const relationshipType = formData.get("relationshipType");
  const selectedRelationship = isRelationshipType(relationshipType)
    ? relationshipType
    : null;
  if (
    typeof requestId !== "string" ||
    requestId.length < 1 ||
    requestId.length > 200 ||
    (response !== "accept" && response !== "decline")
  ) {
    return { error: "Choose a valid response to this connection request." };
  }
  if (response === "accept" && !selectedRelationship) {
    return { error: "Choose how you know this person." };
  }

  const sql = getSql();
  const notificationId = randomUUID();
  const now = new Date().toISOString();
  const [request] = (await sql`
    WITH responded AS (
      UPDATE connected_lives
      SET status = ${response === "accept" ? "accepted" : "declined"},
          relationship_type = ${response === "accept" ? selectedRelationship : null},
          relationship_subject_user_id = CASE WHEN ${response === "accept"} THEN owner_user_id ELSE NULL END,
          accepted_at = CASE WHEN ${response === "accept"} THEN ${now}::timestamptz ELSE NULL END,
          updated_at = ${now}
      WHERE id = ${requestId}
        AND connected_user_id = ${user.id}
        AND status = 'pending'
      RETURNING id, owner_user_id AS "requesterId"
    ),
    read_request AS (
      UPDATE notifications
      SET read_at = ${now}, updated_at = ${now}
      WHERE related_entity_type = 'connected_lives'
        AND related_entity_id = ${requestId}
        AND recipient_user_id = ${user.id}
        AND type = 'connected_lives_request'
        AND EXISTS (SELECT 1 FROM responded)
      RETURNING id
    ),
    response_notification AS (
      INSERT INTO notifications (
        id, recipient_user_id, actor_user_id, type, related_entity_type,
        related_entity_id, message, created_at, updated_at
      )
      SELECT ${notificationId}, responded."requesterId", ${user.id},
             ${response === "accept" ? "connected_lives_accepted" : "connected_lives_declined"},
             'connected_lives', responded.id,
             ${response === "accept"
               ? `You are now connected with ${user.displayName}.`
               : "Connection request declined."},
             ${now}, ${now}
      FROM responded
      ON CONFLICT (
        recipient_user_id, type, related_entity_type, related_entity_id
      )
      DO UPDATE SET
        actor_user_id = EXCLUDED.actor_user_id,
        message = EXCLUDED.message,
        read_at = NULL,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
      RETURNING id
    )
    SELECT responded."requesterId"
    FROM responded
  `) as { requesterId: string }[];
  if (!request) {
    return { error: "This request is no longer available to respond to." };
  }

  refreshConnectionViews(request.requesterId);
  return {
    status: response === "accept" ? "connected" : "none",
    message:
      response === "accept"
        ? "Connected Lives™ request accepted."
        : "Connected Lives™ request declined.",
  };
}

export async function updateConnectedLivesRelationship(
  _previousState: ConnectionActionResult,
  formData: FormData,
): Promise<ConnectionActionResult> {
  const user = await requireUser();
  const connectionId = formData.get("connectionId");
  const relationshipType = formData.get("relationshipType");
  if (
    typeof connectionId !== "string" ||
    connectionId.length < 1 ||
    connectionId.length > 200 ||
    !isRelationshipType(relationshipType)
  ) {
    return { error: "Choose a valid relationship type." };
  }

  const sql = getSql();
  const [connection] = (await sql`
    UPDATE connected_lives
    SET relationship_type = ${relationshipType},
        relationship_subject_user_id = CASE WHEN owner_user_id = ${user.id}
          THEN connected_user_id ELSE owner_user_id END,
        updated_at = ${new Date().toISOString()}
    WHERE id = ${connectionId}
      AND status = 'accepted'
      AND (owner_user_id = ${user.id} OR connected_user_id = ${user.id})
    RETURNING id
  `) as { id: string }[];

  if (!connection) {
    return { error: "This connection is no longer available to update." };
  }

  refreshConnectionViews();
  return { message: "Relationship updated." };
}

export async function addConnectedLifeTag(
  _previousState: ConnectionActionResult,
  formData: FormData,
): Promise<ConnectionActionResult> {
  const user = await requireUser();
  const connectionId = formData.get("connectionId");
  const subjectId = formData.get("subjectId");
  const rawLabel = formData.get("label");
  const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
  if (typeof connectionId !== "string" || connectionId.length < 1 || connectionId.length > 200 ||
      typeof subjectId !== "string" || subjectId.length < 1 || subjectId.length > 200 ||
      !label || label.length > 60) {
    return { error: "Enter a tag of up to 60 characters." };
  }
  const sql = getSql();
  const [result] = (await sql`
    WITH eligible AS (
      SELECT id FROM connected_lives
      WHERE id = ${connectionId} AND status = 'accepted'
        AND (owner_user_id = ${user.id} OR connected_user_id = ${user.id})
        AND (owner_user_id = ${subjectId} OR connected_user_id = ${subjectId})
    ), added AS (
      INSERT INTO connected_lives_person_tags (id, connection_id, subject_user_id, label)
      SELECT ${randomUUID()}, id, ${subjectId}, ${label} FROM eligible
      ON CONFLICT DO NOTHING RETURNING id
    )
    SELECT EXISTS (SELECT 1 FROM eligible) AS eligible,
           EXISTS (SELECT 1 FROM added) AS added
  `) as { eligible: boolean; added: boolean }[];
  if (!result?.eligible) return { error: "This connection or person is no longer available." };
  if (!result.added) return { error: "This person already has that tag on this connection." };
  refreshConnectionViews();
  return { message: "Shared tag added." };
}

export async function removeConnectedLifeTag(
  _previousState: ConnectionActionResult,
  formData: FormData,
): Promise<ConnectionActionResult> {
  const user = await requireUser();
  const tagId = formData.get("tagId");
  if (typeof tagId !== "string" || tagId.length < 1 || tagId.length > 200) {
    return { error: "Choose a valid tag." };
  }
  const sql = getSql();
  const rows = await sql`
    DELETE FROM connected_lives_person_tags AS tag
    WHERE tag.id = ${tagId}
      AND EXISTS (
        SELECT 1 FROM connected_lives AS cl
        WHERE cl.id = tag.connection_id AND cl.status = 'accepted'
          AND (cl.owner_user_id = ${user.id} OR cl.connected_user_id = ${user.id})
          AND (cl.owner_user_id = tag.subject_user_id OR cl.connected_user_id = tag.subject_user_id)
      )
    RETURNING tag.id
  `;
  if (!rows.length) return { error: "This tag or connection is no longer available." };
  refreshConnectionViews();
  return { message: "Shared tag removed." };
}

export async function markLivesNotificationsRead() {
  const user = await requireUser();
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    UPDATE notifications
    SET read_at = ${now},
        updated_at = ${now}
    WHERE recipient_user_id = ${user.id}
      AND read_at IS NULL
  `;
  revalidatePath("/connected-lives");
  revalidatePath("/dashboard");
}
