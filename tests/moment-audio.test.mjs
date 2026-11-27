import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Request, Response, Headers, console,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("audio reservations validate formats, size, and authentication", async () => {
  const audio = loadModule("lib/moment-audio.ts", {});
  assert.equal(audio.getMomentAudioFormat("voice.MP3").contentType, "audio/mpeg");
  assert.equal(audio.getMomentAudioFormat("voice.m4a").contentType, "audio/mp4");
  assert.equal(audio.getMomentAudioFormat("voice.wav").contentType, "audio/wav");
  assert.equal(audio.getMomentAudioFormat("voice.webm"), null);
  assert.equal(audio.getMomentAudioFormat("mp3"), null);
  let user = { id: "owner" };
  const inserts = [];
  const actions = loadModule("lib/moment-audio-actions.ts", {
    "node:crypto": { randomUUID: () => "audio-id" },
    "@vercel/blob": { head: async () => {}, BlobNotFoundError: class extends Error {} },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => async (_strings, ...values) => { inserts.push(values); return []; } },
    "@/lib/moment-audio": audio,
  });
  assert.ok((await actions.beginMomentAudioUpload("voice.webm", 1)).error);
  assert.ok((await actions.beginMomentAudioUpload("voice.mp3", 0)).error);
  assert.ok((await actions.beginMomentAudioUpload("voice.mp3", audio.MAX_MOMENT_AUDIO_BYTES + 1)).error);
  user = null;
  assert.ok((await actions.beginMomentAudioUpload("voice.mp3", 1)).error);
  user = { id: "owner" };
  const result = await actions.beginMomentAudioUpload("voice.mp3", audio.MAX_MOMENT_AUDIO_BYTES);
  assert.equal(result.pathname, "moment-audio/audio-id.mp3");
  assert.equal(inserts.length, 1);
});

test("audio upload tokens and completion are scoped to the owner and verified blob", async () => {
  let user = { id: "owner" };
  let options;
  const route = loadModule("app/api/moment-audio-upload/route.ts", {
    "@vercel/blob/client": { handleUpload: async ({ onBeforeGenerateToken, body }) => {
      options = await onBeforeGenerateToken(body.payload.pathname);
      return { clientToken: "test" };
    } },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => async (_strings, pathname, owner) =>
      pathname === "moment-audio/owned.mp3" && owner === "owner" ? [{ contentType: "audio/mpeg" }] : [] },
    "@/lib/moment-audio": { MAX_MOMENT_AUDIO_BYTES: 100 * 1024 * 1024 },
  });
  const request = () => new Request("https://example.test/api", {
    method: "POST",
    body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: "moment-audio/owned.mp3" } }),
  });
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(options.maximumSizeInBytes, 100 * 1024 * 1024);
  assert.deepEqual(Array.from(options.allowedContentTypes), ["audio/mpeg"]);
  assert.equal(options.allowOverwrite, false);
  user = { id: "other" };
  assert.equal((await route.POST(request())).status, 400);
  user = null;
  assert.equal((await route.POST(request())).status, 401);

  let size = 11;
  let updates = 0;
  user = { id: "owner" };
  const audio = loadModule("lib/moment-audio.ts", {});
  const actions = loadModule("lib/moment-audio-actions.ts", {
    "node:crypto": { randomUUID: () => "unused" },
    "@vercel/blob": {
      head: async () => ({ pathname: "moment-audio/owned.mp3", contentType: "audio/mpeg", size }),
      BlobNotFoundError: class extends Error {},
    },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => async (strings, _id, owner) => {
      if (owner !== "owner") return [];
      if (strings.join("?").includes("SELECT")) return [{ pathname: "moment-audio/owned.mp3", contentType: "audio/mpeg", sizeBytes: 10 }];
      updates++;
      return [{ id: "audio" }];
    } },
    "@/lib/moment-audio": audio,
  });
  assert.ok((await actions.completeMomentAudioUpload("audio")).error);
  assert.equal(updates, 0);
  size = 10;
  assert.equal((await actions.completeMomentAudioUpload("audio")).success, true);
  user = { id: "other" };
  assert.ok((await actions.completeMomentAudioUpload("audio")).error);
});

test("editor uploads audio privately before saving and publishing", async () => {
  const states = [];
  let stateIndex = 0;
  let finishUpload;
  let savedDraft;
  const jsx = (type, props) => ({ type, props });
  const initialDraft = loadModule("lib/moment-types.ts", {}).initialMomentDraft;
  const Editor = loadModule("app/create-moment/moment-editor.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    react: {
      useEffect() {},
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
    },
    "@vercel/blob/client": { upload: async (pathname, file, options) => {
      assert.equal(pathname, "moment-audio/test.mp3");
      assert.equal(file.name, "family.mp3");
      assert.equal(options.access, "private");
      assert.equal(options.handleUploadUrl, "/api/moment-audio-upload");
      options.onUploadProgress({ percentage: 50 });
      await new Promise((resolve) => { finishUpload = resolve; });
    } },
    "next/image": { default: () => null },
    "next/link": { default: () => null },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/lib/moment-actions": {
      loadMomentDraft: async () => ({}), getFamilyPlaceholders: async () => [], publishMoment: async () => ({}),
      getTimeCapsuleRecipients: async () => ({ current: [], future: [], placeholders: [] }),
      saveMomentDraft: async (_kind, _id, draft) => { savedDraft = draft; return { draftId: "draft", accessCodeSaved: false }; },
    },
    "@/app/actions/family-tree": { searchFamilyMomentMakers: async () => ({ results: [] }) },
    "@/lib/moment-types": { initialMomentDraft: initialDraft },
    "@/lib/time-capsule-schedule": loadModule("lib/time-capsule-schedule.ts", {}),
    "@/lib/prepare-moment-photo": { prepareMomentPhoto: async () => ({}) },
    "@/lib/moment-video-actions": {},
    "@/lib/moment-video": {},
    "@/lib/moment-audio-actions": {
      beginMomentAudioUpload: async () => ({ id: "audio-id", pathname: "moment-audio/test.mp3", contentType: "audio/mpeg" }),
      completeMomentAudioUpload: async () => ({ success: true }),
    },
    "@/lib/moment-audio": loadModule("lib/moment-audio.ts", {}),
  }).default;
  function render(kind = "shared") { stateIndex = 0; return Editor({ kind }); }
  function find(node, predicate) {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  render();
  states[0] = { ...initialDraft, content: ["voice"], title: "Audio" };
  states[2] = true;
  let tree = render();
  find(tree, (node) => node.type === "input" && node.props.id === "moment-voice").props.onChange({
    currentTarget: { files: [new File(["audio"], "family.mp3", { type: "audio/mpeg" })], value: "selected" },
  });
  await new Promise((resolve) => setImmediate(resolve));
  tree = render();
  assert.equal(find(tree, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.equal(states[14], 50);
  finishUpload();
  await new Promise((resolve) => setImmediate(resolve));
  tree = render();
  assert.equal(states[0].audioUploadId, "audio-id");
  assert.equal(states[0].attachmentNames.voice, "family.mp3");
  find(tree, (node) => node.type === "button" && node.props.children === "Save Draft").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(savedDraft.audioUploadId, "audio-id");
  states[0] = { ...initialDraft, content: ["voice"], attachmentNames: { voice: "old.mp3" } };
  tree = render();
  find(tree, (node) => node.type === "input" && node.props.id === "moment-voice").props.onChange({
    currentTarget: { files: [new File(["audio"], "bad.webm")], value: "selected" },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(states[0].attachmentNames.voice, "old.mp3");
  assert.match(states[15], /MP3, M4A, or WAV/);
  states[0] = { ...initialDraft, content: [] };
  const otherKind = render("personal");
  const label = find(otherKind, (node) => node.type === "label" && Array.isArray(node.props.children) && node.props.children.includes("Audio"));
  assert.equal(label.props.children[0].props.disabled, true);
});
