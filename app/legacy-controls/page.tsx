import type { Metadata } from "next";
import Link from "next/link";
import { saveLegacyControls } from "@/app/actions/legacy-controls";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import LegacyControlsSaveNotice from "./save-notice";

export const metadata: Metadata = {
  title: "Legacy Controls™ | Never Say Goodbye",
  description:
    "Choose who can find your Moment Maker profile, what they can see, and who can contribute to your story.",
};

export const instant = false;

type LegacyControlSettings = {
  discoverability: "private" | "searchable" | "public";
  featured: boolean;
  publicProfilePhoto: boolean;
  publicProfileBio: boolean;
  publicSharedMoments: boolean;
  publicConnectedLives: boolean;
  publicLegacyTree: boolean;
  publicFutureMomentMakers: boolean;
  publicPersonalMoments: boolean;
  privateMomentAccessRequests: boolean;
  treeParticipation: "owner" | "approved-contributors" | "connected-lives";
  familyContributions: boolean;
  connectedLifeContributions: boolean;
  requireMomentApproval: boolean;
};

const cardClassName =
  "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7";
const optionClassName =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[#D8A35B]/30";

function ToggleSetting({
  id,
  name,
  title,
  description,
  defaultChecked = false,
}: {
  id: string;
  name: string;
  title: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-[#D8A35B]/30"
    >
      <span>
        <span className="block text-sm font-medium text-white">{title}</span>
        {description && (
          <span className="mt-1 block text-sm leading-6 text-slate-400">
            {description}
          </span>
        )}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full border border-white/20 bg-slate-800 transition peer-checked:border-[#D8A35B]/70 peer-checked:bg-[#D8A35B]/30 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#D8A35B]" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-slate-400 transition peer-checked:translate-x-5 peer-checked:bg-[#f0c98e]" />
      </span>
    </label>
  );
}

export default async function LegacyControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const sql = getSql();
  const [settings] = (await sql`
    SELECT
      COALESCE(to_jsonb(u) ->> 'discoverability', 'searchable') AS discoverability,
      COALESCE((to_jsonb(u) ->> 'featured')::boolean, FALSE) AS featured,
      COALESCE((to_jsonb(u) ->> 'public_profile_photo')::boolean, TRUE) AS "publicProfilePhoto",
      COALESCE((to_jsonb(u) ->> 'public_profile_bio')::boolean, TRUE) AS "publicProfileBio",
      COALESCE((to_jsonb(u) ->> 'public_shared_moments')::boolean, TRUE) AS "publicSharedMoments",
      COALESCE((to_jsonb(u) ->> 'public_connected_lives')::boolean, TRUE) AS "publicConnectedLives",
      COALESCE((to_jsonb(u) ->> 'public_legacy_tree')::boolean, TRUE) AS "publicLegacyTree",
      COALESCE((to_jsonb(u) ->> 'public_future_moment_makers')::boolean, FALSE) AS "publicFutureMomentMakers",
      COALESCE((to_jsonb(u) ->> 'public_personal_moments')::boolean, FALSE) AS "publicPersonalMoments",
      COALESCE((to_jsonb(u) ->> 'private_moment_access_requests')::boolean, TRUE) AS "privateMomentAccessRequests",
      COALESCE(to_jsonb(u) ->> 'tree_participation', 'owner') AS "treeParticipation",
      COALESCE((to_jsonb(u) ->> 'family_contributions')::boolean, TRUE) AS "familyContributions",
      COALESCE((to_jsonb(u) ->> 'connected_life_contributions')::boolean, TRUE) AS "connectedLifeContributions",
      COALESCE((to_jsonb(u) ->> 'require_moment_approval')::boolean, TRUE) AS "requireMomentApproval"
    FROM users AS u
    WHERE u.id = ${user.id}
    LIMIT 1
  `) as LegacyControlSettings[];
  const { saved } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />

      <form
        action={saveLegacyControls}
        className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12"
      >
        <Link
          href="/dashboard"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          My Legacy
        </Link>

        <header className="mx-auto mt-12 max-w-2xl text-center sm:mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Your story, your choices
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl">
            Legacy Controls™
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Shape what you share and who helps your family story grow.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-3xl space-y-5 sm:mt-12">
          <p className="rounded-xl border border-[#D8A35B]/20 bg-[#D8A35B]/[0.05] px-4 py-3 text-sm leading-6 text-slate-400">
            Your visibility and contribution choices are saved to your Moment Maker account.
          </p>
          {saved === "1" && (
            <LegacyControlsSaveNotice />
          )}

          <section aria-labelledby="discoverability-heading" className={cardClassName}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
              Can people find me?
            </p>
            <h2
              id="discoverability-heading"
              className="mt-2 font-serif text-xl text-white sm:text-2xl"
            >
              👁 Discoverability
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Control whether other people can find your Moment Maker profile.
            </p>

            <fieldset className="mt-5 space-y-3">
              <legend className="mb-3 text-sm font-semibold text-[#f0c98e]">
                Profile Visibility
              </legend>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="discoverability"
                  value="private"
                  defaultChecked={settings?.discoverability === "private"}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Private</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    Only approved connections can find me.
                  </span>
                </span>
              </label>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="discoverability"
                  value="searchable"
                  defaultChecked={settings?.discoverability === "searchable"}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Searchable Only</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    People may find my profile, but access to my content depends
                    on my visibility settings.
                  </span>
                </span>
              </label>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="discoverability"
                  value="public"
                  defaultChecked={settings?.discoverability === "public"}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Public</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    People may find my profile and view content I have chosen
                    to make public.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="mt-5">
              <ToggleSetting
                id="feature-profile"
                name="featured"
                title="Feature my profile in This Week's Moment Makers™"
                description="Allow my profile to appear in featured Moment Maker listings throughout the platform."
                defaultChecked={settings?.featured ?? false}
              />
            </div>
          </section>

          <section aria-labelledby="public-access-heading" className={cardClassName}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
              What can people see?
            </p>
            <h2
              id="public-access-heading"
              className="mt-2 font-serif text-xl text-white sm:text-2xl"
            >
              🔓 Public Access
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose what visitors can see after finding your profile.
            </p>

            <div className="mt-5 space-y-3">
              <ToggleSetting
                id="public-profile-photo"
                name="publicProfilePhoto"
                title="Profile Photo"
                defaultChecked={settings?.publicProfilePhoto ?? true}
              />
              <ToggleSetting
                id="public-profile-bio"
                name="publicProfileBio"
                title="Bio"
                defaultChecked={settings?.publicProfileBio ?? true}
              />
              <ToggleSetting
                id="public-shared-moments"
                name="publicSharedMoments"
                title="Shared Moments"
                defaultChecked={settings?.publicSharedMoments ?? true}
              />
              <ToggleSetting
                id="public-connected-lives"
                name="publicConnectedLives"
                title="Connected Lives™"
                defaultChecked={settings?.publicConnectedLives ?? true}
              />
              <ToggleSetting
                id="public-legacy-tree"
                name="publicLegacyTree"
                title="Legacy Tree™"
                defaultChecked={settings?.publicLegacyTree ?? true}
              />
              <ToggleSetting
                id="public-future-moment-makers"
                name="publicFutureMomentMakers"
                title="Future Moment Makers™"
                defaultChecked={settings?.publicFutureMomentMakers ?? false}
              />
              <ToggleSetting
                id="public-personal-moments"
                name="publicPersonalMoments"
                title="Personal Moments"
                defaultChecked={settings?.publicPersonalMoments ?? false}
              />
              <ToggleSetting
                id="private-moment-access-requests"
                name="privateMomentAccessRequests"
                title="Allow visitors to request access to private moments"
                description="Visitors may request permission to view moments that are not publicly visible."
                defaultChecked={settings?.privateMomentAccessRequests ?? true}
              />
            </div>
          </section>

          <section
            aria-labelledby="family-contributors-heading"
            className={cardClassName}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
              Who can contribute?
            </p>
            <h2
              id="family-contributors-heading"
              className="mt-2 font-serif text-xl text-white sm:text-2xl"
            >
              🌳 Family &amp; Contributors
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Control who helps build and manage your story.
            </p>

            <fieldset className="mt-5 space-y-3">
              <legend className="mb-3 text-sm font-semibold text-[#f0c98e]">
                Who can make changes to my Legacy Tree™?
              </legend>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="treeParticipation"
                  value="owner"
                  defaultChecked={settings?.treeParticipation === "owner"}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Only Me</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    Only you may modify your Legacy Tree™. Family members and
                    Connected Lives™ may still submit relationship requests and
                    explain how they are related, but those requests will remain
                    pending until you approve them. No one will be added to your
                    Legacy Tree™ automatically.
                  </span>
                </span>
              </label>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="treeParticipation"
                  value="approved-contributors"
                  defaultChecked={settings?.treeParticipation === "approved-contributors"}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Approved Contributors</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    Approved contributors may help manage and update your
                    Legacy Tree™.
                  </span>
                </span>
              </label>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="treeParticipation"
                  value="connected-lives"
                  defaultChecked={settings?.treeParticipation === "connected-lives"}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Connected Lives™</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    Connected Lives™ may help manage and update your Legacy
                    Tree™.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="mt-7 border-t border-white/10 pt-5">
              <h3 className="font-serif text-lg text-white">
                Future Moment Makers™
              </h3>
              <div className="mt-4 space-y-3">
                <ToggleSetting
                  id="family-contributions"
                  name="familyContributions"
                  title="Allow family members to contribute moments"
                  defaultChecked={settings?.familyContributions ?? true}
                />
                <ToggleSetting
                  id="connected-life-contributions"
                  name="connectedLifeContributions"
                  title="Allow Connected Lives™ to contribute moments"
                  defaultChecked={settings?.connectedLifeContributions ?? true}
                />
                <ToggleSetting
                  id="require-moment-approval"
                  name="requireMomentApproval"
                  title="Require approval before moments are added"
                  defaultChecked={settings?.requireMomentApproval ?? true}
                />
              </div>
            </div>

            <div className="mt-7 rounded-xl border border-[#D8A35B]/25 bg-white/[0.02] p-4 sm:p-5">
              <h3 className="font-serif text-lg text-white">
                🤝 Merge Moment Makers™
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Combine two Tier 3 Moment Makers into a shared Legacy Tree™.
                This prevents duplicate family trees and allows spouses or
                family members to manage one tree together.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8A35B]/60 px-5 py-2.5 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
              >
                Merge Legacy Trees
              </button>
            </div>
          </section>

          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#D8A35B] px-7 py-3 text-sm font-semibold text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            Save Legacy Controls™
          </button>

          <section
            aria-labelledby="profile-preview-heading"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center sm:p-7"
          >
            <h2
              id="profile-preview-heading"
              className="font-serif text-xl text-white sm:text-2xl"
            >
              👁 Preview My Public Profile
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              See your profile exactly as visitors will see it.
            </p>
            <Link
              href="/my-profile/preview"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
            >
              Preview My Profile
            </Link>
          </section>
        </div>
      </form>
    </main>
  );
}
