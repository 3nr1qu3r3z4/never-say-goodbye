"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { createHonoredLife, type HonoredLifeState } from "@/app/actions/honored-lives";
import { toSupportedImage } from "@/lib/convert-image";

export type Tree = { id: string; name: string };
export type Placeholder = {
  id: string;
  treeId: string;
  name: string;
  relationship: string;
  birthDate: string;
  birthYear: number | null;
  deathYear: number | null;
};

const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

async function preparePhoto(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
  const supported = await toSupportedImage(file);
  const url = URL.createObjectURL(supported);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened."));
      image.src = url;
    });
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo preparation is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.85);
    if (!result.startsWith("data:image/jpeg;base64,")) {
      throw new Error("This browser could not prepare the photo.");
    }
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function HonoredLifeForm({ trees, placeholders }: { trees: Tree[]; placeholders: Placeholder[] }) {
  const [state, action, pending] = useActionState<HonoredLifeState, FormData>(createHonoredLife, {});
  const [treeId, setTreeId] = useState(trees[0]?.id ?? "");
  const [placeholderId, setPlaceholderId] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [passingDate, setPassingDate] = useState("");
  const [story, setStory] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const photoAttempt = useRef(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const options = placeholders.filter((placeholder) => placeholder.treeId === treeId);
  const selected = options.find((placeholder) => placeholder.id === placeholderId);

  function clearPhoto() {
    photoAttempt.current++;
    if (photoInput.current) photoInput.current.value = "";
    setPhoto("");
    setPhotoError("");
    setPreparing(false);
  }

  function clearDetails() {
    setPassingDate("");
    setStory("");
    clearPhoto();
  }

  function choosePlaceholder(id: string) {
    const placeholder = options.find((item) => item.id === id);
    clearDetails();
    setPlaceholderId(id);
    setName(placeholder?.name ?? "");
    setRelationship(placeholder?.relationship ?? "");
    setBirthDate(placeholder?.birthDate ?? "");
  }

  async function selectPhoto(file: File | undefined) {
    const attempt = ++photoAttempt.current;
    setPhoto("");
    setPhotoError("");
    if (!file) {
      setPreparing(false);
      return;
    }
    setPreparing(true);
    try {
      const prepared = await preparePhoto(file);
      if (attempt === photoAttempt.current) setPhoto(prepared);
    } catch (error) {
      if (attempt === photoAttempt.current) {
        setPhotoError(error instanceof Error ? error.message : "The photo could not be prepared.");
      }
    } finally {
      if (attempt === photoAttempt.current) setPreparing(false);
    }
  }

  if (!trees.length) {
    return <p className="mt-8 rounded-2xl border border-white/10 p-5 text-slate-300">A tree owner or administrator can create an Honored Life. <Link href="/legacy-tree" className="text-[#f0c98e] underline">Visit your Legacy Tree™</Link>.</p>;
  }
  if (state.success && state.treeId) {
    return <div className="mt-8 rounded-2xl border border-white/10 p-5">
      <p role="status" className="text-[#f0c98e]">{state.success}</p>
      <Link href={`/legacy-tree#legacy-tree-item-${encodeURIComponent(state.treeId)}`} className="mt-4 inline-block text-[#f0c98e] underline">View your Legacy Tree™</Link>
      <p className="mt-3"><a href="/honored-lives" className="text-[#f0c98e] underline">Honor another life</a></p>
    </div>;
  }

  return (
    <form action={action} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <label className="block text-sm font-medium">Legacy Tree™
        <select name="treeId" value={treeId} onChange={(event) => {
          setTreeId(event.target.value);
          setPlaceholderId("");
          setName("");
          setRelationship("");
          setBirthDate("");
          clearDetails();
        }} className={fieldClass} required>
          {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Family Placeholder™
        <select name="placeholderId" value={placeholderId} onChange={(event) => choosePlaceholder(event.target.value)} className={fieldClass}>
          <option value="">Create a new placeholder</option>
          {options.map((placeholder) => <option key={placeholder.id} value={placeholder.id}>{placeholder.name} · {placeholder.relationship}</option>)}
        </select>
      </label>
      <p className="text-sm leading-6 text-slate-400">Choosing an existing placeholder updates its name, relationship and birth date. Birth dates can appear in the tree calendar when imports are enabled. All members of this tree can see the Honored Life. Changing the tree or placeholder clears the story, passing date and photo.</p>
      {selected && (selected.birthYear || selected.deathYear) && (
        <p className="text-sm text-slate-400">Existing years: born {selected.birthYear ?? "unknown"}; passed {selected.deathYear ?? "unknown"}. Full dates must match recorded years.</p>
      )}
      <label className="block text-sm font-medium">Name
        <input name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Relationship
        <input name="relationship" value={relationship} onChange={(event) => setRelationship(event.target.value)} required maxLength={80} className={fieldClass} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">Birth Date (optional)
          <input name="birthDate" type="date" min="1000-01-01" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-medium">Passing Date (optional)
          <input name="passingDate" type="date" min="1000-01-01" value={passingDate} onChange={(event) => setPassingDate(event.target.value)} className={fieldClass} />
        </label>
      </div>
      <label className="block text-sm font-medium">Short Story (optional)
        <textarea name="story" maxLength={1000} rows={5} value={story} onChange={(event) => setStory(event.target.value)} className={`${fieldClass} py-3`} />
      </label>
      <label className="block text-sm font-medium">Profile Photo (optional)
        <input ref={photoInput} type="file" accept="image/*,.heic,.heif" onChange={(event) => void selectPhoto(event.currentTarget.files?.[0])} className={`${fieldClass} py-3`} />
      </label>
      <input type="hidden" name="photoData" value={photo} />
      <p aria-live="polite" className={`text-sm ${photoError ? "text-rose-300" : "text-slate-400"}`}>
        {photoError || (preparing ? "Preparing photo…" : photo ? "Photo ready." : "Choose a photo up to 20 MB.")}
      </p>
      {(photo || photoError || preparing) && <button type="button" className="text-sm text-[#f0c98e] underline" onClick={clearPhoto}>Remove photo</button>}
      <button type="submit" disabled={pending || preparing || Boolean(photoError)} className="min-h-12 rounded-full bg-[#D8A35B] px-7 py-3 text-sm font-semibold text-[#0F172A] disabled:opacity-60">
        {pending ? "Saving…" : "Create Honored Life"}
      </button>
      {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
    </form>
  );
}
