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

test("video format and size validation rejects unsupported and oversized files", async () => {
  const video = loadModule("lib/moment-video.ts", {});
  assert.equal(video.getMomentVideoFormat("file.MOV").contentType, "video/quicktime");
  assert.equal(video.getMomentVideoFormat("file.m4v").contentType, "video/mp4");
  assert.equal(video.getMomentVideoFormat("file.mp4").contentType, "video/mp4");
  assert.equal(video.getMomentVideoFormat("file.webm"), null);
  const inserts = [];
  const actions = loadModule("lib/moment-video-actions.ts", {
    "node:crypto": { randomUUID: () => "unique-id" },
    "@vercel/blob": { head: async () => {}, BlobNotFoundError: class extends Error {} },
    "@/lib/auth": { getCurrentUser: async () => ({ id: "owner" }) },
    "@/lib/db": { getSql: () => async (strings, ...values) => { inserts.push(values); return []; } },
    "@/lib/moment-video": video,
  });
  assert.ok((await actions.beginMomentVideoUpload("bad.webm", 1)).error);
  assert.ok((await actions.beginMomentVideoUpload("big.mp4", video.MAX_MOMENT_VIDEO_BYTES + 1)).error);
  assert.ok((await actions.beginMomentVideoUpload("empty.mp4", 0)).error);
  assert.equal(inserts.length, 0);
  const result = await actions.beginMomentVideoUpload("movie.mp4", video.MAX_MOMENT_VIDEO_BYTES);
  assert.equal(result.pathname, "moment-videos/unique-id.mp4");
  assert.equal(inserts.length, 1);
});

test("video upload tokens are scoped to a pending upload owned by the session", async () => {
  let user = { id: "owner" };
  let options;
  const route = loadModule("app/api/moment-video-upload/route.ts", {
    "@vercel/blob/client": {
      handleUpload: async ({ onBeforeGenerateToken, body }) => {
        options = await onBeforeGenerateToken(body.payload.pathname);
        return { type: "blob.generate-client-token", clientToken: "test" };
      },
    },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => async (_strings, pathname, owner) =>
      pathname === "moment-videos/owned.mp4" && owner === "owner" ? [{ contentType: "video/mp4" }] : [] },
    "@/lib/moment-video": { MAX_MOMENT_VIDEO_BYTES: 100 * 1024 * 1024 },
  });
  const request = (pathname) => new Request("https://example.test/api", {
    method: "POST",
    body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname } }),
  });
  assert.equal((await route.POST(request("moment-videos/owned.mp4"))).status, 200);
  assert.equal(options.maximumSizeInBytes, 100 * 1024 * 1024);
  assert.deepEqual(Array.from(options.allowedContentTypes), ["video/mp4"]);
  assert.equal(options.allowOverwrite, false);
  user = null;
  assert.equal((await route.POST(request("moment-videos/owned.mp4"))).status, 401);
  user = { id: "other" };
  assert.equal((await route.POST(request("moment-videos/owned.mp4"))).status, 400);
});

test("video completion verifies the owner's actual uploaded blob before marking it ready", async () => {
  let size = 10;
  let owner = "owner";
  let updates = 0;
  const video = loadModule("lib/moment-video.ts", {});
  const actions = loadModule("lib/moment-video-actions.ts", {
    "node:crypto": { randomUUID: () => "unused" },
    "@vercel/blob": {
      head: async () => ({ pathname: "moment-videos/test.mp4", contentType: "video/mp4", size }),
      BlobNotFoundError: class extends Error {},
    },
    "@/lib/auth": { getCurrentUser: async () => ({ id: owner }) },
    "@/lib/db": { getSql: () => async (strings, _id, user) => {
      if (user !== "owner") return [];
      if (strings.join("?").includes("SELECT")) {
        return [{ pathname: "moment-videos/test.mp4", contentType: "video/mp4", sizeBytes: 10 }];
      }
      updates++;
      return [{ id: "video" }];
    } },
    "@/lib/moment-video": video,
  });
  owner = "other";
  assert.ok((await actions.completeMomentVideoUpload("video")).error);
  owner = "owner";
  size = 11;
  assert.ok((await actions.completeMomentVideoUpload("video")).error);
  assert.equal(updates, 0);
  size = 10;
  assert.equal((await actions.completeMomentVideoUpload("video")).success, true);
  assert.equal(updates, 1);
});

test("the Shared Moment editor uploads before saving and disables publishing while uploading", async () => {
  const states = [];
  let stateIndex = 0;
  let finishUpload;
  let savedDraft;
  const jsx = (type, props) => ({ type, props });
  const initialDraft = loadModule("lib/moment-types.ts", {}).initialMomentDraft;
  const video = loadModule("lib/moment-video.ts", {});
  const Editor = loadModule("app/create-moment/moment-editor.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    react: {
      useEffect() {},
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => {
          states[index] = typeof value === "function" ? value(states[index]) : value;
        }];
      },
    },
    "@vercel/blob/client": { upload: async (pathname, file, options) => {
      assert.equal(pathname, "moment-videos/test.mp4");
      assert.equal(file.name, "family.mp4");
      assert.equal(options.access, "private");
      options.onUploadProgress({ percentage: 50 });
      await new Promise((resolve) => { finishUpload = resolve; });
    } },
    "next/image": { default: () => null },
    "next/link": { default: () => null },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/lib/moment-actions": {
      loadMomentDraft: async () => ({}), getFamilyPlaceholders: async () => [],
      getTimeCapsuleRecipients: async () => ({ current: [], future: [], placeholders: [] }),
      publishMoment: async () => ({}),
      saveMomentDraft: async (_kind, _id, draft) => {
        savedDraft = draft;
        return { draftId: "draft", accessCodeSaved: false };
      },
    },
    "@/app/actions/family-tree": { searchFamilyMomentMakers: async () => ({ results: [] }) },
    "@/lib/moment-types": { initialMomentDraft: initialDraft },
    "@/lib/time-capsule-schedule": loadModule("lib/time-capsule-schedule.ts", {}),
    "@/lib/prepare-moment-photo": { prepareMomentPhoto: async () => ({}) },
    "@/lib/moment-video-actions": {
      beginMomentVideoUpload: async () => ({ id: "video-id", pathname: "moment-videos/test.mp4", contentType: "video/mp4" }),
      completeMomentVideoUpload: async (id) => {
        assert.equal(id, "video-id");
        return { success: true };
      },
    },
    "@/lib/moment-video": video,
    "@/lib/moment-audio-actions": {},
    "@/lib/moment-audio": {},
  }).default;
  function render(kind = "shared") {
    stateIndex = 0;
    return Editor({ kind });
  }
  function find(node, predicate) {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  render();
  states[0] = { ...initialDraft, content: ["video"], title: "Video" };
  states[2] = true;
  let tree = render();
  find(tree, (node) => node.type === "input" && node.props.id === "moment-video").props.onChange({
    currentTarget: { files: [new File(["video"], "family.mp4", { type: "video/mp4" })], value: "selected" },
  });
  await new Promise((resolve) => setImmediate(resolve));
  tree = render();
  assert.equal(find(tree, (node) => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.equal(states[10], 50);
  finishUpload();
  await new Promise((resolve) => setImmediate(resolve));
  tree = render();
  assert.equal(states[0].videoUploadId, "video-id");
  assert.equal(states[0].attachmentNames.video, "family.mp4");
  find(tree, (node) => node.type === "button" && node.props.children === "Save Draft").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(savedDraft.videoUploadId, "video-id");
  states[0] = { ...initialDraft, content: [] };
  const otherKind = render("personal");
  const videoLabel = find(otherKind, (node) => node.type === "label" && Array.isArray(node.props.children) && node.props.children.includes("Video"));
  assert.equal(videoLabel.props.children[0].props.disabled, true);
});

test("playback authorizes each request and forwards valid byte ranges privately", async () => {
  let allowed = true;
  let fetches = 0;
  let requestedRange;
  const stream = loadModule("lib/moment-media-stream.ts", {
    "@vercel/blob": { get: async (_path, options) => {
      fetches++;
      requestedRange = options.headers?.Range;
      const contentRange = requestedRange ? `bytes ${requestedRange.slice(6)}/10` : null;
      return {
        statusCode: 200,
        headers: new Headers(contentRange ? { "content-range": contentRange } : {}),
        stream: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])); controller.close(); } }),
      };
    } },
  });
  const route = loadModule("app/api/moments/[id]/video/route.ts", {
    "@/lib/moment-media-stream": stream,
    "@/lib/auth": { getCurrentUser: async () => ({ id: "viewer" }) },
    "@/lib/cannot-open-until": { getAccessibleTimeCapsule: async () => null },
    "@/lib/moment-access": { getAccessibleMoment: async (viewer, id, includePhoto) => {
      assert.equal(viewer, "viewer");
      assert.equal(id, "moment");
      assert.equal(includePhoto, false);
      return allowed ? { hasVideo: true } : null;
    } },
    "@/lib/db": { getSql: () => async () => [{ pathname: "private/path.mp4", contentType: "video/mp4", sizeBytes: 10 }] },
  });
  const call = (range) => route.GET(new Request("https://example.test/api", {
    headers: range ? { Range: range } : {},
  }), { params: Promise.resolve({ id: "moment" }) });
  const part = await call("bytes=2-5");
  assert.equal(part.status, 206);
  assert.equal(requestedRange, "bytes=2-5");
  assert.equal(part.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(part.headers.get("content-length"), "4");
  assert.equal(part.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Array.from(new Uint8Array(await part.arrayBuffer())), [1, 2, 3, 4]);
  assert.equal((await call("bytes=-4")).status, 206);
  assert.equal(requestedRange, "bytes=6-9");
  assert.equal((await call("bytes=10-")).status, 416);
  assert.equal((await call("bytes=1-2,4-5")).status, 416);
  assert.equal(fetches, 2);
  const full = await call();
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-length"), "10");
  allowed = false;
  assert.equal((await call()).status, 404);
  assert.equal(fetches, 3);
});
