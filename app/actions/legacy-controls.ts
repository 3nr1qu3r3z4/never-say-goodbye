"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

const discoverabilityOptions = ["private", "searchable", "public"] as const;
const treeParticipationOptions = [
  "owner",
  "approved-contributors",
  "connected-lives",
] as const;

export async function saveLegacyControls(formData: FormData): Promise<void> {
  const discoverability = formData.get("discoverability");
  const treeParticipation = formData.get("treeParticipation");

  if (
    typeof discoverability !== "string" ||
    !discoverabilityOptions.includes(
      discoverability as (typeof discoverabilityOptions)[number],
    ) ||
    typeof treeParticipation !== "string" ||
    !treeParticipationOptions.includes(
      treeParticipation as (typeof treeParticipationOptions)[number],
    )
  ) {
    throw new Error("Choose valid Legacy Controls settings.");
  }

  const user = await requireUser();
  const sql = getSql();
  await sql`
    UPDATE users
    SET discoverability = ${discoverability},
        featured = ${formData.get("featured") === "on"},
        public_profile_photo = ${formData.get("publicProfilePhoto") === "on"},
        public_profile_bio = ${formData.get("publicProfileBio") === "on"},
        public_shared_moments = ${formData.get("publicSharedMoments") === "on"},
        public_connected_lives = ${formData.get("publicConnectedLives") === "on"},
        public_legacy_tree = ${formData.get("publicLegacyTree") === "on"},
        public_future_moment_makers = ${formData.get("publicFutureMomentMakers") === "on"},
        public_personal_moments = ${formData.get("publicPersonalMoments") === "on"},
        private_moment_access_requests = ${formData.get("privateMomentAccessRequests") === "on"},
        tree_participation = ${treeParticipation},
        family_contributions = ${formData.get("familyContributions") === "on"},
        connected_life_contributions = ${formData.get("connectedLifeContributions") === "on"},
        require_moment_approval = ${formData.get("requireMomentApproval") === "on"},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
  `;

  revalidatePath("/legacy-controls");
  revalidatePath("/my-profile/preview");
  redirect("/legacy-controls?saved=1");
}
