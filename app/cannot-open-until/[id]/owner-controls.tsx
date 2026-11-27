"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { activateTimeCapsule, createClaimLink, decideTimeCapsuleClaim, deleteTimeCapsule, reassignTimeCapsule, releaseTimeCapsule, saveTimeCapsuleContent } from "@/app/actions/cannot-open-until";
import { changeArchiveState } from "@/app/actions/content-archive";
import { searchFamilyMomentMakers } from "@/app/actions/family-tree";
import { beginMomentAudioUpload, completeMomentAudioUpload } from "@/lib/moment-audio-actions";
import { beginMomentVideoUpload, completeMomentVideoUpload } from "@/lib/moment-video-actions";
import { prepareMomentPhoto } from "@/lib/prepare-moment-photo";
import { formatTimeCapsuleInstant } from "@/lib/time-capsule-schedule";

export type OwnerMoment = {
  id: string; title: string; story: string; tags: string; message: string; version: string;
  hasPhoto: boolean; hasVideo: boolean; hasAudio: boolean;
  photoName: string | null; videoName: string | null; audioName: string | null;
  archived: boolean; review: boolean; released: boolean;
  recipientId: string | null; recipientName: string | null;
  recipientKind: "current" | "future" | "placeholder" | null; intendedId: string | null;
  releaseDate: string | null; releaseTimezone: string | null;
  releaseTime: string | null; unlockAt: string | null;
  oldReleaseDate: string | null; oldOccasion: string | null;
};

const card = "mt-6 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 sm:p-7";
const field = "mt-2 block w-full rounded-xl border border-[color:var(--nsg-border)]/20 bg-slate-950/50 p-3 text-white";
const button = "mt-4 rounded-full border border-[color:var(--nsg-accent)]/50 px-5 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:bg-white/5 disabled:opacity-50";

function Feedback({ state }: { state: { error?: string; success?: string } }) {
  return <p role="status" className="mt-3 text-sm text-slate-300">{state.error ?? state.success}</p>;
}

function ContentEditor({ moment }: { moment: OwnerMoment }) {
  const [state, action, saving] = useActionState(saveTimeCapsuleContent, {});
  const [photo, setPhoto] = useState({ action: "keep", data: "", name: "" });
  const [video, setVideo] = useState({ action: "keep", id: "", name: "" });
  const [audio, setAudio] = useState({ action: "keep", id: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function selectFile(kind: "photo" | "video" | "audio", file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "photo") {
        const prepared = await prepareMomentPhoto(file);
        setPhoto({ action: "replace", data: prepared.data, name: prepared.name });
      } else {
        const reservation = kind === "video"
          ? await beginMomentVideoUpload(file.name, file.size)
          : await beginMomentAudioUpload(file.name, file.size);
        if ("error" in reservation) throw new Error(reservation.error);
        await upload(reservation.pathname, file, {
          access: "private",
          handleUploadUrl: kind === "video" ? "/api/moment-video-upload" : "/api/moment-audio-upload",
          contentType: reservation.contentType,
        });
        const completed = kind === "video" ? await completeMomentVideoUpload(reservation.id) : await completeMomentAudioUpload(reservation.id);
        if ("error" in completed) throw new Error(completed.error);
        const selection = { action: "replace", id: reservation.id, name: file.name };
        if (kind === "video") setVideo(selection); else setAudio(selection);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be uploaded. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form action={action} className={card}>
    <h2 className="font-serif text-2xl text-white">Edit content</h2>
    <p className="mt-2 text-sm text-slate-400">Content becomes permanently read-only when this Moment is released.</p>
    <input type="hidden" name="id" value={moment.id} /><input type="hidden" name="version" value={moment.version} />
    <input type="hidden" name="photoAction" value={photo.action} /><input type="hidden" name="photoData" value={photo.data} /><input type="hidden" name="photoName" value={photo.name} />
    <input type="hidden" name="videoAction" value={video.action} /><input type="hidden" name="videoId" value={video.id} />
    <input type="hidden" name="audioAction" value={audio.action} /><input type="hidden" name="audioId" value={audio.id} />
    <label className="mt-5 block text-sm font-semibold">Title<input className={field} name="title" defaultValue={moment.title} maxLength={200} required /></label>
    <label className="mt-5 block text-sm font-semibold">Story<textarea className={field} name="story" defaultValue={moment.story} maxLength={50000} rows={6} /></label>
    <label className="mt-5 block text-sm font-semibold">Written message<textarea className={field} name="message" defaultValue={moment.message} maxLength={50000} rows={4} /></label>
    <label className="mt-5 block text-sm font-semibold">Tags<input className={field} name="tags" defaultValue={moment.tags} maxLength={2000} /></label>
    {(["photo", "video", "audio"] as const).map((kind) => {
      const current = kind === "photo" ? photo : kind === "video" ? video : audio;
      const existing = kind === "photo" ? moment.photoName : kind === "video" ? moment.videoName : moment.audioName;
      return <div key={kind} className="mt-5">
        <label className="block text-sm font-semibold capitalize">{kind}
          <input type="file" className="mt-2 block w-full text-sm text-slate-300" disabled={busy || saving}
            accept={kind === "photo" ? "image/*,.heic,.heif" : kind === "video" ? ".mp4,.mov,.m4v" : ".mp3,.m4a,.wav"}
            onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void selectFile(kind, file); }} />
        </label>
        <p className="mt-2 text-sm text-slate-400">{current.action === "remove" ? "Will be removed when saved." : current.name || existing || "No file selected."}</p>
        <button type="button" className="mt-2 text-sm text-[color:var(--nsg-accent-light)] underline" disabled={busy || saving}
          onClick={() => { setError(""); if (kind === "photo") setPhoto({ action: "remove", data: "", name: "" }); else if (kind === "video") setVideo({ action: "remove", id: "", name: "" }); else setAudio({ action: "remove", id: "", name: "" }); }}>Remove {kind}</button>
      </div>;
    })}
    {busy && <p role="status" className="mt-4 text-sm text-slate-300">Preparing your file…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <button className={button} disabled={busy || saving || !!error}>{saving ? "Saving…" : "Save content"}</button>
    <Feedback state={state} />
  </form>;
}

type RecipientCandidates = {
  current: { id: string; name: string }[];
  future: { id: string; name: string; relationship: string }[];
  placeholders: { id: string; name: string; relationship: string }[];
};

export default function OwnerControls({ moment, candidates, claims }: {
  moment: OwnerMoment; candidates: RecipientCandidates; claims: { id: string; name: string }[];
}) {
  const [scheduleState, scheduleAction, scheduling] = useActionState(activateTimeCapsule, {});
  const [recipientState, recipientAction, reassigning] = useActionState(reassignTimeCapsule, {});
  const [claimState, claimAction, creatingClaim] = useActionState(createClaimLink, {});
  const [decisionState, decisionAction, decidingClaim] = useActionState(decideTimeCapsuleClaim, {});
  const [releaseState, releaseAction, releasing] = useActionState(releaseTimeCapsule, {});
  const [archiveState, archiveAction, archiving] = useActionState(changeArchiveState, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteTimeCapsule, {});
  const [current, setCurrent] = useState(candidates.current);
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  async function searchRecipients() {
    try {
      const result = await searchFamilyMomentMakers(search);
      if (result.error) { setSearchError(result.error); return; }
      setCurrent((existing) => Array.from(new Map([
        ...existing.map((person) => [person.id, person] as const),
        ...result.results.map((person) => [person.id, { id: person.id, name: person.displayName }] as const),
      ]).values()));
      setSearchError(result.results.length ? "" : "No searchable Moment Makers found.");
    } catch { setSearchError("The search could not be completed. Please try again."); }
  }
  const intended = moment.recipientKind && moment.intendedId ? `${moment.recipientKind}:${moment.intendedId}` : "";
  const options = [
    ...current.map((person) => ({ value: `current:${person.id}`, name: person.name, group: "Current Moment Makers" })),
    ...candidates.future.map((person) => ({ value: `future:${person.id}`, name: `${person.name} · ${person.relationship}`, group: "Future Moment Makers™" })),
    ...candidates.placeholders.map((person) => ({ value: `placeholder:${person.id}`, name: `${person.name} · ${person.relationship}`, group: "Family Placeholders™" })),
  ];
  if (intended && !options.some((person) => person.value === intended)) {
    options.push({ value: intended, name: moment.recipientName ?? "Existing recipient", group: "Existing recipient" });
  }
  return <>
    <section className={card}>
      <h2 className="font-serif text-2xl text-white">{moment.review ? "Review Required" : moment.released ? "Released · Read-only" : "Scheduled"}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{moment.review
        ? "This Moment is inactive. Review the content, choose an intended recipient and a concrete date, then activate it."
        : moment.intendedId ? `Recipient: ${moment.recipientName || "Intended recipient"}${moment.recipientId ? "" : " · Awaiting claim or re-authorization"}` : "Recipient unavailable. Owner review is required."}</p>
      {!moment.review && <p className="mt-2 text-sm text-slate-400">Opens: {moment.unlockAt && moment.releaseTimezone ? formatTimeCapsuleInstant(moment.unlockAt, moment.releaseTimezone) ?? "Open time unavailable" : "Open time unavailable"} ({moment.releaseTimezone}){moment.archived ? " · Archived" : ""}</p>}
      {moment.review && (moment.oldReleaseDate || moment.oldOccasion) && <p className="mt-3 text-sm text-slate-400">Previously saved reference: {[moment.oldReleaseDate, moment.oldOccasion].filter(Boolean).join(" · ")}. This is not an active schedule.</p>}
      {!moment.released ? <form action={scheduleAction} className="mt-4">
        <input type="hidden" name="id" value={moment.id} />
        <label className="mt-4 block text-sm font-semibold">Find a searchable Moment Maker
          <input value={search} onChange={(event) => setSearch(event.target.value)} className={field} />
        </label>
        <button type="button" className={button} onClick={() => void searchRecipients()}>Search</button>
        {searchError && <p role="status" className="mt-2 text-sm text-slate-400">{searchError}</p>}
        <label className="mt-4 block text-sm font-semibold">Who is this for?
          <select name="recipient" defaultValue={intended} required className={field}>
            <option value="" disabled>Select a recipient</option>
            {["Current Moment Makers", "Future Moment Makers™", "Family Placeholders™", "Existing recipient"].map((group) =>
              options.some((person) => person.group === group) && <optgroup key={group} label={group}>
                {options.filter((person) => person.group === group).map((person) => <option key={person.value} value={person.value}>{person.name}</option>)}
              </optgroup>)}
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold">Release date<input type="date" name="date" required defaultValue={moment.releaseDate ?? ""} className={field} /></label>
        <label className="mt-4 block text-sm font-semibold">Open time<input type="time" name="time" required defaultValue={moment.releaseTime ?? "00:00"} className={field} /></label>
        <label className="mt-4 block text-sm font-semibold">Time zone<input name="timezone" required defaultValue={moment.releaseTimezone ?? "UTC"} className={field} /></label>
        <p className="mt-2 text-sm text-slate-400">Use an IANA time zone, such as America/New_York, or UTC. Times skipped or repeated by daylight saving are not allowed.</p>
        <button className={button} disabled={scheduling || !options.length}>{scheduling ? "Saving…" : moment.review ? "Activate schedule" : "Update schedule"}</button>
        <Feedback state={scheduleState} />
      </form> : <p className="mt-4 text-sm text-slate-400">The intended recipient cannot be changed after release.</p>}
      {!moment.review && !moment.recipientId && moment.intendedId && <form action={recipientAction}>
        <input type="hidden" name="id" value={moment.id} />
        <button className={button} disabled={reassigning}>Re-authorize intended recipient</button><Feedback state={recipientState} />
      </form>}
      {!moment.review && (moment.recipientKind === "future" || moment.recipientKind === "placeholder") && !moment.recipientId && <>
        <form action={claimAction}>
          <input type="hidden" name="id" value={moment.id} />
          <button className={button} disabled={creatingClaim || claims.length > 0}>Create private claim link</button>
          <Feedback state={claimState} />
          {claimState.claimToken && <label className="mt-3 block text-sm text-slate-300">Private claim link
            <input readOnly className={field} value={`${window.location.origin}/cannot-open-until/claim#${claimState.claimToken}`} onFocus={(event) => event.currentTarget.select()} />
          </label>}
        </form>
        {claims.map((claim) => <form key={claim.id} action={decisionAction} className="mt-5">
          <input type="hidden" name="claim" value={claim.id} />
          <p className="text-sm text-slate-300">Claim request from {claim.name}. Confirm their identity independently; a name alone is not proof.</p>
          <button name="decision" value="approve" className={button} disabled={decidingClaim}>Approve claim</button>{" "}
          <button name="decision" value="decline" className={button} disabled={decidingClaim}>Decline</button>
          <Feedback state={decisionState} />
        </form>)}
      </>}
      {!moment.review && !moment.released && <form action={releaseAction} onSubmit={(event) => { if (!window.confirm("Release now? This is irreversible and the content will become read-only.")) event.preventDefault(); }}>
        <input type="hidden" name="id" value={moment.id} /><button className={button} disabled={releasing}>Release now</button><Feedback state={releaseState} />
      </form>}
    </section>
    <section className={card}>
      <h2 className="font-serif text-2xl text-white">Your preserved content</h2>
      {moment.story && <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.story}</p>}
      {moment.message && <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.message}</p>}
      {moment.hasPhoto && <Image src={`/api/moments/${encodeURIComponent(moment.id)}/photo`} alt={`Photo for ${moment.title}`} width={1000} height={1000} unoptimized className="mt-5 max-h-96 w-auto rounded-xl object-contain" />}
      {moment.hasVideo && <video controls preload="metadata" src={`/api/moments/${encodeURIComponent(moment.id)}/video`} className="mt-5 w-full rounded-xl" />}
      {moment.hasAudio && <audio controls preload="metadata" src={`/api/moments/${encodeURIComponent(moment.id)}/audio`} className="mt-5 w-full" />}
      {([["Photo", moment.photoName, moment.hasPhoto], ["Video", moment.videoName, moment.hasVideo], ["Audio", moment.audioName, moment.hasAudio]] as const).filter(([, name, hasFile]) => name && !hasFile).map(([label, name]) =>
        <p key={label} className="mt-3 text-sm text-slate-400">{label}: {name} (file name only; not uploaded)</p>)}
    </section>
    {!moment.released && <ContentEditor key={moment.version} moment={moment} />}
    <section className={card}>
      <h2 className="font-serif text-2xl text-white">Manage Moment</h2>
      <form action={archiveAction} onSubmit={(event) => { if (moment.archived && moment.released && !window.confirm("Restore this Moment? Its assigned recipient can immediately open it.")) event.preventDefault(); }}>
        <input type="hidden" name="id" value={moment.id} /><input type="hidden" name="kind" value="moment" /><input type="hidden" name="operation" value={moment.archived ? "restore" : "archive"} />
        <button className={button} disabled={archiving}>{moment.archived ? "Restore" : "Archive"}</button><Feedback state={archiveState} />
      </form>
      <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("Permanently delete this Moment and its contents? This cannot be undone.")) event.preventDefault(); }}>
        <input type="hidden" name="id" value={moment.id} /><button className={button} disabled={deleting}>Delete permanently</button><Feedback state={deleteState} />
      </form>
    </section>
  </>;
}
