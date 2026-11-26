import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Buffer, ...globals,
    process, Request, Response, console,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("moment page authorizes before rendering and hides denied or missing moments", async () => {
  let allowed = false;
  let signedIn = true;
  let photoData = null;
  let hasVideo = false;
  let hasAudio = false;
  const calls = [];
  const page = loadModule("app/moments/[id]/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/image": { default: (props) => React.createElement("img", { src: props.src, alt: props.alt }) },
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { getCurrentUser: async () => signedIn ? { id: "viewer" } : null },
    "@/lib/moment-access": {
      getAccessibleMoment: async (...args) => {
        calls.push(args);
        return allowed
          ? {
            id: "moment", title: "A story", authorName: "Author", authorId: "author", hasVideo, hasAudio,
            story: "Memory", writtenMessage: "Message", tags: "family",
            photoName: "photo.jpg", photoData, videoName: "video.mp4", voiceName: "old.mp3",
          }
          : null;
      },
    },
  }).default;

  await assert.rejects(page({ params: Promise.resolve({ id: "moment" }) }), /not found/);
  assert.deepEqual(calls[0], ["viewer", "moment"]);
  allowed = true;
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "moment" }) }));
  assert.match(html, /A story/);
  assert.match(html, /Memory/);
  assert.match(html, /Message/);
  assert.match(html, /Tags: family/);
  assert.match(html, /Photo: photo.jpg/);
  assert.match(html, /Audio: old.mp3/);
  assert.match(html, /files were not uploaded/);
  photoData = "data:image/jpeg;base64,/9j/2Q==";
  const withPhoto = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "moment" }) }));
  assert.match(withPhoto, /src="data:image\/jpeg;base64,\/9j\/2Q=="/);
  assert.doesNotMatch(withPhoto, /Photo: photo.jpg/);
  assert.match(withPhoto, /Video: video.mp4/);
  assert.match(withPhoto, /files were not uploaded/);
  hasVideo = true;
  const withVideo = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "moment" }) }));
  assert.match(withVideo, /<video[^>]*src="\/api\/moments\/moment\/video"/);
  assert.doesNotMatch(withVideo, /Video: video.mp4/);
  hasAudio = true;
  const withAudio = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "moment" }) }));
  assert.match(withAudio, /<audio[^>]*controls=""/);
  assert.match(withAudio, /src="\/api\/moments\/moment\/audio"/);
  assert.doesNotMatch(withAudio, /Audio: old.mp3/);
  signedIn = false;
  await page({ params: Promise.resolve({ id: "moment" }) });
  assert.deepEqual(calls[5], [null, "moment"]);
});

test("shared moment cards link their previews and titles without enclosing the actions menu", async () => {
  const rows = [
    { id: "photo/id", title: "Turning 5", story: "", writtenMessage: null, hasPhoto: true, hasVideo: false, authorName: "Alex", isAuthor: true },
    { id: "video", title: "Family video", story: "", writtenMessage: null, hasPhoto: false, hasVideo: true, authorName: "Sam", isAuthor: false },
    { id: "text", title: "A story", story: "Today we celebrated together.", writtenMessage: null, hasPhoto: false, hasVideo: false, authorName: "Lee", isAuthor: true },
    { id: "message", title: "A note", story: " ", writtenMessage: "Thinking of you.", hasPhoto: false, hasVideo: false, authorName: "Lee", isAuthor: true },
    { id: "audio", title: "Family recording", story: "", writtenMessage: null, hasPhoto: false, hasVideo: false, hasAudio: true, authorName: "Sam", isAuthor: false },
  ];
  const card = loadModule("app/moments/moment-card.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "./moment-actions-menu": { default: ({ title }) => React.createElement("button", null, `Actions for ${title}`) },
    "./video-preview": { default: ({ momentId }) => React.createElement("span", { "data-video": momentId }, "▶") },
  }).default;
  const page = loadModule("app/moments/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "@/lib/auth": { requireUser: async () => ({ id: "viewer" }) },
    "@/lib/moment-access": { getAccessibleMoments: async (id) => { assert.equal(id, "viewer"); return rows; } },
    "./moment-card": { default: card },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /🎵 Audio/);
  assert.match(html, /<button>Actions for Turning 5<\/button><a href="\/moments\/photo%2Fid"[\s\S]*?<img[^>]*src="\/api\/moments\/photo%2Fid\/photo"[\s\S]*?Turning 5[\s\S]*?<\/a>/);
  assert.match(html, /href="\/moments\/video"[\s\S]*?data-video="video"[\s\S]*?Family video[\s\S]*?Video Moment[\s\S]*?<\/a>/);
  assert.match(html, /href="\/moments\/text"[\s\S]*?Today we celebrated together\.[\s\S]*?<\/a>/);
  assert.match(html, /href="\/moments\/message"[\s\S]*?Thinking of you\.[\s\S]*?<\/a>/);
  assert.doesNotMatch(html, /<a[^>]*>[^<]*<button/);
});

test("photo previews recheck access and return private image data only for authorized moments", async () => {
  const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  let result = null;
  let viewer = { id: "viewer" };
  const calls = [];
  const route = loadModule("app/api/moments/[id]/photo/route.ts", {
    "@/lib/auth": { getCurrentUser: async () => viewer },
    "@/lib/moment-access": { getAccessibleMoment: async (...args) => { calls.push(args); return result; } },
    "@/lib/profile-photo": loadModule("lib/profile-photo.ts", { "server-only": {} }),
  });
  const get = () => route.GET(new Request("https://example.test/photo"), { params: Promise.resolve({ id: "moment" }) });
  assert.equal((await get()).status, 404);
  assert.deepEqual(calls[0], ["viewer", "moment"]);
  result = { photoData: photo };
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(photo.split(",")[1], "base64"));
  viewer = null;
  result = null;
  const denied = await get();
  assert.equal(denied.status, 404);
  assert.equal(denied.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(calls[2], [null, "moment"]);
});

test("video previews load the authorized first frame near the viewport", () => {
  let visible = false;
  let callback;
  let observed = false;
  let disconnected = false;
  class Observer {
    constructor(onIntersection) { callback = onIntersection; }
    observe() { observed = true; }
    disconnect() { disconnected = true; }
  }
  const jsx = (type, props) => ({ type, props });
  let effect;
  const VideoPreview = loadModule("app/moments/video-preview.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useEffect: (fn) => { effect = fn; },
      useRef: () => ({ current: {} }),
      useState: () => [visible, (value) => { visible = value; }],
    },
  }, { window: { IntersectionObserver: Observer }, IntersectionObserver: Observer }).default;
  const initial = VideoPreview({ momentId: "video/id" });
  assert.equal(initial.props.children[0], false);
  const cleanup = effect();
  assert.equal(observed, true);
  callback([{ isIntersecting: false }]);
  assert.equal(visible, false);
  callback([{ isIntersecting: true }]);
  assert.equal(visible, true);
  assert.equal(disconnected, true);
  const loaded = VideoPreview({ momentId: "video/id" }).props.children[0];
  assert.equal(loaded.type, "video");
  assert.equal(loaded.props.src, "/api/moments/video%2Fid/video#t=0.001");
  assert.equal(loaded.props.preload, "metadata");
  assert.equal(loaded.props.muted, true);
  cleanup();
});

test("moment menu confirms deletion and hides management actions from non-authors", async () => {
  const states = [];
  const menu = { open: true, contains: () => false };
  let opened = 0;
  let closed = 0;
  let refreshed = 0;
  let calls = 0;
  let fail = true;
  const refs = [
    { current: menu },
    { current: { focus() {} } },
    { current: { showModal: () => { opened++; }, close: () => { closed++; } } },
  ];
  let refIndex = 0;
  const jsx = (type, props) => ({ type, props });
  const Menu = loadModule("app/moments/moment-actions-menu.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    react: {
      useEffect() {},
      useId: () => "id",
      useRef: () => refs[refIndex++],
      useState: (initial) => {
        const index = states.length;
        states.push(initial);
        return [initial, (value) => { states[index] = value; }];
      },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshed++; } }) },
    "@/app/actions/moments": { deleteSharedMoment: async (id) => {
      calls++;
      assert.equal(id, "moment");
      return fail ? { error: "Could not delete" } : { success: true };
    } },
  }).default;
  function find(node, predicate) {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  const tree = Menu({ momentId: "moment", title: "Story", isAuthor: true });
  const deleteButton = find(tree, (node) => node.type === "button" && node.props.children === "Delete Moment");
  assert.ok(deleteButton);
  assert.ok(find(tree, (node) => node.type === "button" && node.props.disabled && Array.isArray(node.props.children) && node.props.children[0] === "Edit Moment "));
  deleteButton.props.onClick();
  assert.equal(opened, 1);
  assert.equal(menu.open, false);
  assert.equal(calls, 0);
  find(tree, (node) => node.type === "button" && node.props.children === "Cancel").props.onClick();
  assert.equal(closed, 1);
  assert.equal(calls, 0);
  deleteButton.props.onClick();
  const form = find(tree, (node) => node.type === "form");
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(states[1], "Could not delete");
  assert.equal(refreshed, 0);
  fail = false;
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 2);
  assert.equal(closed, 2);
  assert.equal(refreshed, 1);

  refIndex = 0;
  states.length = 0;
  const visitorTree = Menu({ momentId: "moment", title: "Story", isAuthor: false });
  assert.ok(find(visitorTree, (node) => node.type === "a" && node.props.children === "View Moment"));
  assert.equal(find(visitorTree, (node) => node.type === "button" && node.props.children === "Delete Moment"), undefined);
  assert.equal(find(visitorTree, (node) => node.type === "dialog"), undefined);
});

test("moment audiences are enforced against current relationships in PostgreSQL", {
  skip: process.env.LEGACY_TREE_TEST_PGLITE ? false : "Set LEGACY_TREE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.LEGACY_TREE_TEST_PGLITE);
  const db = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }

    for (const id of ["author", "accepted", "reverse", "pending", "declined", "relative", "outsider"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', '2026-01-01', '2026-01-01')`, [id, `${id}@example.test`]);
    }
    await db.exec(`
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('accepted', 'author', 'accepted', 'Accepted', 'Friend', 'accepted', '2026-01-01', '2026-01-01'),
             ('reverse', 'reverse', 'author', 'Author', 'Friend', 'accepted', '2026-01-01', '2026-01-01'),
             ('pending', 'author', 'pending', 'Pending', 'Friend', 'pending', '2026-01-01', '2026-01-01'),
             ('declined', 'author', 'declined', 'Declined', 'Friend', 'declined', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('shared-tree', 'author', 'Shared', '2026-01-01', '2026-01-01'),
             ('other-tree', 'outsider', 'Other', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('shared-tree', 'author', 'owner', '2026-01-01'),
             ('shared-tree', 'relative', 'member', '2026-01-01'),
             ('other-tree', 'outsider', 'owner', '2026-01-01');
      INSERT INTO moments (id, user_id, kind, title, story, details_json, audience, access_code_hash, created_at, updated_at)
      VALUES ('connections', 'author', 'shared', 'Connection title', 'Connection story', '{"writtenMessage":"Connection message"}', 'connections', NULL, '2026-01-01', '2026-01-01'),
             ('family', 'author', 'shared', 'Family title', 'Family story', '{}', 'family', NULL, '2026-01-01', '2026-01-01'),
             ('protected', 'author', 'personal', 'Protected', 'Secret', '{}', 'private', 'hash', '2026-01-01', '2026-01-01'),
             ('scheduled', 'author', 'cannot-open-until', 'Scheduled', 'Secret', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('future', 'author', 'future-moment-maker', 'Future', 'Secret', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('private', 'author', 'shared', 'Private', 'Secret', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('public', 'author', 'shared', 'Public', 'Public story', '{}', 'public', NULL, '2026-01-01', '2026-01-01'),
             ('unexpected-code', 'author', 'shared', 'Protected', 'Secret', '{}', 'connections', 'hash', '2026-01-01', '2026-01-01');
      INSERT INTO moment_videos (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('public-video', 'author', 'public', 'moment-videos/public.mp4', 'public.mp4', 'video/mp4', 100, 'attached');
    `);
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    sql.transaction = async (statements) => Promise.all(statements);
    const access = loadModule("lib/moment-access.ts", {
      "server-only": {},
      "@/lib/db": { getSql: () => sql },
    });

    for (const viewer of ["author", "accepted", "reverse"]) {
      assert.equal((await access.getAccessibleMoment(viewer, "connections"))?.story, "Connection story", viewer);
    }
    assert.equal((await access.getAccessibleMoment("accepted", "connections"))?.writtenMessage, "Connection message");
    assert.equal(await access.getAccessibleMoment(null, "connections"), null);
    assert.equal(await access.getAccessibleMoment(null, "family"), null);
    for (const viewer of ["pending", "declined", "relative", "outsider"]) {
      assert.equal(await access.getAccessibleMoment(viewer, "connections"), null, viewer);
    }
    for (const viewer of ["author", "relative"]) {
      assert.equal((await access.getAccessibleMoment(viewer, "family"))?.story, "Family story", viewer);
    }
    for (const viewer of ["accepted", "pending", "outsider"]) {
      assert.equal(await access.getAccessibleMoment(viewer, "family"), null, viewer);
    }
    for (const id of ["protected", "scheduled", "future", "unexpected-code", "missing"]) {
      assert.equal(await access.getAccessibleMoment("author", id), null, id);
      assert.equal(await access.getAccessibleMoment("accepted", id), null, id);
    }
    assert.equal((await access.getAccessibleMoment("author", "private"))?.story, "Secret");
    assert.equal(await access.getAccessibleMoment("accepted", "private"), null);
    assert.equal((await access.getAccessibleMoment(null, "public"))?.story, "Public story");
    assert.equal((await access.getAccessibleMoment(null, "public"))?.hasVideo, true);
    assert.equal((await access.getAccessibleMoment("author", "public"))?.isAuthor, true);
    assert.deepEqual(Array.from(await access.getAccessibleMoments("relative"), (moment) => moment.id), ["family"]);
    assert.deepEqual(Array.from(await access.getAccessibleMoments("author"), (moment) => moment.id).sort(), ["connections", "family", "private", "public"]);
    assert.deepEqual(Array.from(await access.getAccessibleMoments("outsider"), (moment) => moment.id), []);
    assert.deepEqual(Array.from(await access.getRecentOwnMoments("author"), (moment) => moment.id).sort(), ["connections", "family", "private", "public"]);
    assert.deepEqual(Array.from(await access.getRecentOwnMoments("relative"), (moment) => moment.id), []);
    for (const viewer of [null, "author", "relative", "outsider"]) {
      const profileMoments = await access.getPublicProfileSharedMoments(viewer, "author");
      assert.deepEqual(Array.from(profileMoments, (moment) => moment.id), ["public"]);
      assert.equal(profileMoments[0].hasVideo, true);
      assert.equal(profileMoments[0].isAuthor, viewer === "author");
      assert.equal(profileMoments[0].photoData, null);
    }
    assert.deepEqual(Array.from(await access.getPublicProfileSharedMoments(null, "outsider")), []);

    await db.exec(`UPDATE moments SET details_json = '{"photoData":"data:image/jpeg;base64,abc"}' WHERE id = 'family'`);
    const activityFor = async (viewer) => Array.from(await access.getRecentFamilyActivity(viewer), (moment) => moment.id);
    assert.deepEqual(await activityFor("accepted"), ["connections", "public"]);
    assert.deepEqual(await activityFor("reverse"), ["connections", "public"]);
    assert.deepEqual(await activityFor("relative"), ["family", "public"]);
    for (const viewer of ["author", "pending", "declined", "outsider"]) {
      assert.deepEqual(await activityFor(viewer), [], viewer);
    }
    const familyFeed = await access.getRecentFamilyActivity("relative");
    assert.equal(familyFeed[0].hasPhoto, true);
    assert.equal(familyFeed[0].photoData, null);
    assert.equal(familyFeed[1].hasVideo, true);
    assert.equal((await access.getRecentFamilyActivity("accepted"))[0].hasMessage, true);
    await db.query("UPDATE moments SET created_at = $1 WHERE id = 'connections'",
      [new Date(Date.now() - 5 * 60000).toISOString()]);
    assert.equal((await access.getRecentFamilyActivity("accepted"))[0].relativeTime, "5 minutes ago");
    await db.exec("UPDATE moments SET created_at = '2026-01-01' WHERE id = 'connections'");
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'accepted'");
    assert.deepEqual(await activityFor("accepted"), []);
    await db.exec("UPDATE connected_lives SET status = 'accepted' WHERE id = 'accepted'");
    await db.exec("DELETE FROM legacy_tree_members WHERE tree_id = 'shared-tree' AND user_id = 'relative'");
    assert.deepEqual(await activityFor("relative"), []);
    await db.exec("INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('shared-tree', 'relative', 'member', '2026-01-01')");
    for (let i = 1; i <= 12; i++) {
      await db.query(`INSERT INTO moments (id, user_id, kind, title, story, details_json, audience, created_at, updated_at)
        VALUES ($1, 'author', 'shared', 'Recent', 'Story', '{}', 'connections', $2, $2)`,
      [`recent-${i}`, `2026-03-${String(i).padStart(2, "0")}`]);
    }
    const recent = await activityFor("accepted");
    assert.equal(recent.length, 5);
    assert.equal((await access.getRecentOwnMoments("author")).length, 5);
    assert.equal(recent[0], "recent-12");
    assert.equal(recent[4], "recent-8");
    await db.exec("DELETE FROM moments WHERE id LIKE 'recent-%'");

    await db.exec("UPDATE users SET public_shared_moments = FALSE WHERE id = 'author'");
    assert.equal(await access.getAccessibleMoment(null, "public"), null);
    assert.equal((await access.getAccessibleMoment("author", "public"))?.story, "Public story");
    assert.equal((await access.getPublicProfileSharedMoments("author", "author")).length, 0);
    assert.equal((await access.getPublicProfileSharedMoments(null, "author")).length, 0);
    assert.deepEqual(await activityFor("accepted"), ["connections"]);
    await db.exec("UPDATE users SET public_shared_moments = TRUE, discoverability = 'private' WHERE id = 'author'");
    assert.equal(await access.getAccessibleMoment(null, "public"), null);
    assert.equal((await access.getAccessibleMoment("author", "public"))?.story, "Public story");
    assert.equal((await access.getPublicProfileSharedMoments("author", "author")).length, 0);
    assert.equal((await access.getPublicProfileSharedMoments(null, "author")).length, 0);
    assert.deepEqual(await activityFor("relative"), ["family"]);

    const { initialMomentDraft } = loadModule("lib/moment-types.ts", {});
    const { validatePhoto } = loadModule("lib/profile-photo.ts", { "server-only": {} });
    const editor = loadModule("lib/moment-actions.ts", {
      "node:crypto": { randomUUID },
      "@/lib/auth": { getCurrentUser: async () => ({ id: "author" }) },
      "@/lib/db": { getSql: () => sql },
      "@/lib/password": { hashSecret: async () => "hash" },
      "@/lib/profile-photo": { validatePhoto },
    });
    const photoData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    const photoDraft = {
      ...initialMomentDraft, title: "Photo memory", content: ["photo"],
      attachmentNames: { photo: "family.png" }, photoData, audience: "family",
    };
    assert.match((await editor.publishMoment("shared", "", { ...photoDraft, photoData: "" })).error, /Choose a photo/);
    assert.ok((await editor.saveMomentDraft("shared", "", { ...photoDraft, photoData: "invalid" })).error);
    assert.ok((await editor.publishMoment("shared", "", { ...photoDraft, photoData: "invalid" })).error);
    const saved = await editor.saveMomentDraft("shared", "", photoDraft);
    assert.ok(saved.draftId);
    assert.equal((await editor.loadMomentDraft("shared")).draft.photoData, photoData);
    assert.equal((await editor.publishMoment("shared", saved.draftId, photoDraft)).success, true);
    const [published] = (await db.query("SELECT id, details_json FROM moments WHERE title = 'Photo memory'")).rows;
    assert.equal(JSON.parse(published.details_json).photoData, photoData);
    assert.equal((await editor.loadMomentDraft("shared")).draft, null);
    assert.equal((await access.getAccessibleMoment("author", published.id)).photoData, photoData);
    assert.equal((await access.getAccessibleMoment("relative", published.id)).photoData, photoData);
    assert.equal(await access.getAccessibleMoment("accepted", published.id), null);
    assert.equal(await access.getAccessibleMoment(null, published.id), null);
    assert.equal((await access.getAccessibleMoments("relative")).find((moment) => moment.id === published.id).photoData, null);
    let photoViewer = { id: "relative" };
    const photoRoute = loadModule("app/api/moments/[id]/photo/route.ts", {
      "@/lib/auth": { getCurrentUser: async () => photoViewer },
      "@/lib/moment-access": access,
      "@/lib/profile-photo": { validatePhoto },
    });
    const getPhoto = () => photoRoute.GET(new Request("https://example.test/photo"), { params: Promise.resolve({ id: published.id }) });
    assert.equal((await getPhoto()).status, 200);
    photoViewer = { id: "accepted" };
    assert.equal((await getPhoto()).status, 404);
    photoViewer = { id: "relative" };
    await db.exec("DELETE FROM legacy_tree_members WHERE tree_id = 'shared-tree' AND user_id = 'relative'");
    assert.equal((await getPhoto()).status, 404);
    await db.exec("INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('shared-tree', 'relative', 'member', '2026-01-01')");
    assert.equal((await getPhoto()).status, 200);

    const withoutPhoto = { ...photoDraft, title: "No photo", story: "Story", content: ["written"] };
    const savedWithoutPhoto = await editor.saveMomentDraft("shared", "", withoutPhoto);
    assert.equal((await editor.loadMomentDraft("shared")).draft.photoData, "");
    assert.equal((await editor.publishMoment("shared", savedWithoutPhoto.draftId, withoutPhoto)).success, true);
    const [withoutPhotoRow] = (await db.query("SELECT details_json FROM moments WHERE title = 'No photo'")).rows;
    assert.equal(JSON.parse(withoutPhotoRow.details_json).photoData, null);
    assert.equal(JSON.parse(withoutPhotoRow.details_json).attachmentNames.photo, undefined);
    const { photoData: ignored, videoUploadId: ignoredVideo, audioUploadId: ignoredAudio, ...legacyDraft } = photoDraft;
    assert.ok(ignored);
    assert.equal(ignoredVideo, "");
    assert.equal(ignoredAudio, "");
    await db.query(`INSERT INTO drafts (id, user_id, kind, title, payload_json, created_at, updated_at)
      VALUES ('old-draft', 'author', 'shared', 'Old', $1, '2026-01-01', '2026-01-01')`, [JSON.stringify(legacyDraft)]);
    const restored = await editor.loadMomentDraft("shared");
    assert.equal(restored.draft.photoData, "");
    assert.equal(restored.draft.videoUploadId, "");
    assert.equal(restored.draft.audioUploadId, "");
    assert.equal(restored.draft.attachmentNames.photo, "family.png");
    assert.match((await editor.publishMoment("shared", restored.draftId, restored.draft)).error, /Choose a photo/);
    await db.query(`INSERT INTO drafts (id, user_id, kind, title, payload_json, created_at, updated_at)
      VALUES ('old-audio-draft', 'author', 'shared', 'Old audio', $1, '9999-01-01', '9999-01-01')`,
    [JSON.stringify({ ...legacyDraft, content: ["voice"], photoData: "", videoUploadId: "", attachmentNames: { voice: "old.mp3" } })]);
    const restoredAudio = await editor.loadMomentDraft("shared");
    assert.equal(restoredAudio.draft.attachmentNames.voice, "old.mp3");
    assert.equal(restoredAudio.draft.audioUploadId, "");
    assert.match((await editor.publishMoment("shared", restoredAudio.draftId, restoredAudio.draft)).error, /Upload audio/);
    await db.exec("DELETE FROM drafts WHERE id = 'old-audio-draft'");

    await db.exec(`
      INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video-own', 'author', 'moment-videos/own.mp4', 'own.mp4', 'video/mp4', 100, 'ready'),
             ('video-other', 'outsider', 'moment-videos/other.mp4', 'other.mp4', 'video/mp4', 100, 'ready');
    `);
    const videoDraft = {
      ...initialMomentDraft, title: "Video memory", content: ["video"],
      attachmentNames: { video: "own.mp4" }, videoUploadId: "video-own", audience: "family",
    };
    assert.match((await editor.publishMoment("shared", "", { ...videoDraft, videoUploadId: "" })).error, /Upload a video/);
    assert.match((await editor.publishMoment("shared", "", { ...videoDraft, videoUploadId: "video-other" })).error, /no longer available/);
    assert.match((await editor.saveMomentDraft("shared", "", { ...videoDraft, videoUploadId: "video-other" })).error, /no longer available/);
    const savedVideo = await editor.saveMomentDraft("shared", "", videoDraft);
    assert.equal((await editor.loadMomentDraft("shared")).draft.videoUploadId, "video-own");
    assert.equal((await editor.publishMoment("shared", savedVideo.draftId, videoDraft)).success, true);
    const [videoMoment] = (await db.query("SELECT id FROM moments WHERE title = 'Video memory'")).rows;
    assert.equal((await access.getAccessibleMoment("relative", videoMoment.id)).hasVideo, true);
    assert.equal(await access.getAccessibleMoment("outsider", videoMoment.id), null);
    assert.match((await editor.publishMoment("shared", "", videoDraft)).error, /no longer available/);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moments WHERE title = 'Video memory'")).rows[0].n, 1);
    await db.exec(`INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video-race', 'author', 'moment-videos/race.mp4', 'race.mp4', 'video/mp4', 100, 'ready')`);
    const raceDraft = { ...videoDraft, title: "Concurrent video", videoUploadId: "video-race" };
    const raceResults = await Promise.all([
      editor.publishMoment("shared", "", raceDraft),
      editor.publishMoment("shared", "", raceDraft),
    ]);
    assert.equal(raceResults.filter((result) => result.success).length, 1);
    assert.equal(raceResults.filter((result) => result.error).length, 1);

    await db.exec(`
      INSERT INTO moment_audio (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('audio-own', 'author', 'moment-audio/own.mp3', 'own.mp3', 'audio/mpeg', 100, 'ready'),
             ('audio-mixed', 'author', 'moment-audio/mixed.wav', 'mixed.wav', 'audio/wav', 100, 'ready'),
             ('audio-race', 'author', 'moment-audio/race.mp3', 'race.mp3', 'audio/mpeg', 100, 'ready'),
             ('audio-other', 'outsider', 'moment-audio/other.m4a', 'other.m4a', 'audio/mp4', 100, 'ready');
      INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video-mixed', 'author', 'moment-videos/mixed.mp4', 'mixed.mp4', 'video/mp4', 100, 'ready');
    `);
    const audioDraft = {
      ...initialMomentDraft, title: "Audio memory", content: ["voice"],
      attachmentNames: { voice: "own.mp3" }, audioUploadId: "audio-own", audience: "family",
    };
    assert.match((await editor.publishMoment("shared", "", { ...audioDraft, audioUploadId: "" })).error, /Upload audio/);
    assert.match((await editor.saveMomentDraft("shared", "", { ...audioDraft, audioUploadId: "audio-other" })).error, /no longer available/);
    const savedAudio = await editor.saveMomentDraft("shared", "", audioDraft);
    assert.equal((await editor.loadMomentDraft("shared")).draft.audioUploadId, "audio-own");
    assert.equal((await editor.publishMoment("shared", savedAudio.draftId, audioDraft)).success, true);
    const [audioMoment] = (await db.query("SELECT id FROM moments WHERE title = 'Audio memory'")).rows;
    assert.equal((await access.getAccessibleMoment("relative", audioMoment.id)).hasAudio, true);
    assert.equal(await access.getAccessibleMoment("outsider", audioMoment.id), null);
    assert.match((await editor.publishMoment("shared", "", audioDraft)).error, /no longer available/);
    const audioRaceDraft = { ...audioDraft, title: "Concurrent audio", audioUploadId: "audio-race" };
    const audioRaceResults = await Promise.all([
      editor.publishMoment("shared", "", audioRaceDraft),
      editor.publishMoment("shared", "", audioRaceDraft),
    ]);
    assert.equal(audioRaceResults.filter((result) => result.success).length, 1);
    assert.equal(audioRaceResults.filter((result) => result.error).length, 1);

    const mixedDraft = {
      ...audioDraft, title: "Mixed memory", story: "A story", content: ["voice", "video", "photo"],
      photoData, attachmentNames: { voice: "mixed.wav", video: "mixed.mp4", photo: "family.png" },
      audioUploadId: "audio-mixed", videoUploadId: "video-mixed",
    };
    assert.match((await editor.publishMoment("shared", "", { ...mixedDraft, audioUploadId: "audio-other" })).error, /no longer available/);
    assert.equal((await db.query("SELECT state FROM moment_videos WHERE id = 'video-mixed'")).rows[0].state, "ready");
    assert.match((await editor.publishMoment("shared", "", { ...mixedDraft, videoUploadId: "video-other" })).error, /no longer available/);
    assert.equal((await db.query("SELECT state FROM moment_audio WHERE id = 'audio-mixed'")).rows[0].state, "ready");
    assert.equal((await editor.publishMoment("shared", "", mixedDraft)).success, true);
    const [mixedMoment] = (await db.query("SELECT id FROM moments WHERE title = 'Mixed memory'")).rows;
    const accessibleMixed = await access.getAccessibleMoment("relative", mixedMoment.id);
    assert.equal(accessibleMixed.hasAudio, true);
    assert.equal(accessibleMixed.hasVideo, true);
    assert.equal(accessibleMixed.hasPhoto, true);

    let audioViewer = { id: "relative" };
    let audioStreams = 0;
    const audioStream = loadModule("lib/moment-media-stream.ts", {
      "@vercel/blob": { get: async (pathname, options) => {
        assert.equal(pathname, "moment-audio/own.mp3");
        assert.equal(options.access, "private");
        audioStreams++;
        const range = options.headers?.Range;
        const contentRange = range ? `bytes ${range.slice(6)}/100` : null;
        return {
          statusCode: 200,
          headers: new Headers(contentRange ? { "content-range": contentRange } : {}),
          stream: new ReadableStream({ start(controller) {
            controller.enqueue(new Uint8Array(range ? [1, 2, 3, 4] : new Array(100).fill(0)));
            controller.close();
          } }),
        };
      } },
    }, { Headers });
    const audioRoute = loadModule("app/api/moments/[id]/audio/route.ts", {
      "@/lib/auth": { getCurrentUser: async () => audioViewer },
      "@/lib/moment-access": access,
      "@/lib/db": { getSql: () => sql },
      "@/lib/moment-media-stream": audioStream,
    });
    const getAudio = (range) => audioRoute.GET(new Request("https://example.test/audio", {
      headers: range ? { Range: range } : {},
    }), { params: Promise.resolve({ id: audioMoment.id }) });
    assert.equal((await getAudio()).status, 200);
    const audioPart = await getAudio("bytes=2-5");
    assert.equal(audioPart.status, 206);
    assert.equal(audioPart.headers.get("content-range"), "bytes 2-5/100");
    assert.equal(audioPart.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Array.from(new Uint8Array(await audioPart.arrayBuffer())), [1, 2, 3, 4]);
    audioViewer = { id: "outsider" };
    assert.equal((await getAudio()).status, 404);
    assert.equal(audioStreams, 2);
    audioViewer = { id: "relative" };

    await db.exec(`
      UPDATE connected_lives SET status = 'declined' WHERE id = 'accepted';
      DELETE FROM legacy_tree_members WHERE tree_id = 'shared-tree' AND user_id = 'relative';
    `);
    assert.equal(await access.getAccessibleMoment("accepted", "connections"), null);
    assert.equal(await access.getAccessibleMoment("relative", "family"), null);
    assert.equal(await access.getAccessibleMoment("relative", published.id), null);
    assert.equal(await access.getAccessibleMoment("relative", videoMoment.id), null);
    assert.equal(await access.getAccessibleMoment("relative", audioMoment.id), null);
    assert.equal((await getAudio()).status, 404);
    assert.equal((await access.getAccessibleMoments("relative")).length, 0);

    let currentUser = null;
    const revalidated = [];
    const actions = loadModule("app/actions/moments.ts", {
      "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
      "@/lib/auth": { getCurrentUser: async () => currentUser },
      "@/lib/db": { getSql: () => sql },
    });
    assert.match((await actions.deleteSharedMoment("family")).error, /Sign in/);
    currentUser = { id: "reverse" };
    assert.match((await actions.deleteSharedMoment("connections")).error, /no longer available/);
    currentUser = { id: "outsider" };
    assert.match((await actions.deleteSharedMoment("family")).error, /no longer available/);
    assert.ok(await access.getAccessibleMoment("author", "family"));
    currentUser = { id: "author" };
    assert.match((await actions.deleteSharedMoment("")).error, /could not be found/);
    assert.match((await actions.deleteSharedMoment("protected")).error, /no longer available/);
    assert.match((await actions.deleteSharedMoment("missing")).error, /no longer available/);
    assert.equal(revalidated.length, 0);
    assert.equal((await actions.deleteSharedMoment("family")).success, true);
    assert.equal((await actions.deleteSharedMoment(videoMoment.id)).success, true);
    assert.equal((await actions.deleteSharedMoment(audioMoment.id)).success, true);
    assert.equal((await getAudio()).status, 404);
    const [detachedAudio] = (await db.query("SELECT moment_id, state FROM moment_audio WHERE id = 'audio-own'")).rows;
    assert.equal(detachedAudio.moment_id, null);
    assert.equal(detachedAudio.state, "attached");
    const [detachedVideo] = (await db.query("SELECT moment_id, state FROM moment_videos WHERE id = 'video-own'")).rows;
    assert.equal(detachedVideo.moment_id, null);
    assert.equal(detachedVideo.state, "attached");
    assert.equal(await access.getAccessibleMoment("author", "family"), null);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM moments WHERE id = 'family'")).rows[0].count, 0);
    assert.equal((await actions.deleteSharedMoment("private")).success, true);
    assert.equal((await actions.deleteSharedMoment("public")).success, true);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM moments WHERE id = 'protected'")).rows[0].count, 1);
    assert.ok(revalidated.some(([path]) => path === "/moments"));
    assert.ok(revalidated.some(([path]) => path === "/my-profile/preview"));

    await db.exec(`
      INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state, last_used_at)
      VALUES ('abandoned', 'author', 'moment-videos/abandoned.mp4', 'old.mp4', 'video/mp4', 100, 'ready', CURRENT_TIMESTAMP - INTERVAL '8 days'),
             ('kept', 'author', 'moment-videos/kept.mp4', 'kept.mp4', 'video/mp4', 100, 'ready', CURRENT_TIMESTAMP - INTERVAL '8 days');
      INSERT INTO drafts (id, user_id, kind, title, payload_json, created_at, updated_at)
      VALUES ('kept-draft', 'author', 'shared', 'Kept', '{"videoUploadId":"kept"}', '2026-01-01', '2026-01-01');
    `);
    let cleanupFails = true;
    const deletedBlobs = [];
    const retention = loadModule("app/api/cron/moment-videos/route.ts", {
      "@vercel/blob": { del: async (pathname) => {
        if (cleanupFails) throw new Error("storage unavailable");
        deletedBlobs.push(pathname);
      } },
      "next/server": { connection: async () => {} },
      "@/lib/db": { getSql: () => sql },
    });
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    try {
      assert.equal((await retention.GET(new Request("https://example.test/cron"))).status, 401);
      const cronRequest = () => new Request("https://example.test/cron", { headers: { Authorization: "Bearer test-secret" } });
      assert.equal((await retention.GET(cronRequest())).status, 500);
      cleanupFails = false;
      assert.equal((await retention.GET(cronRequest())).status, 204);
      assert.ok(deletedBlobs.includes("moment-videos/own.mp4"));
      assert.ok(deletedBlobs.includes("moment-videos/abandoned.mp4"));
      assert.equal(deletedBlobs.includes("moment-videos/kept.mp4"), false);
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_videos WHERE id = 'kept'")).rows[0].n, 1);
    } finally {
      if (originalSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = originalSecret;
    }

    await db.exec(`
      INSERT INTO moment_audio (id, user_id, pathname, filename, content_type, size_bytes, state, last_used_at)
      VALUES ('audio-abandoned', 'author', 'moment-audio/abandoned.mp3', 'old.mp3', 'audio/mpeg', 100, 'ready', CURRENT_TIMESTAMP - INTERVAL '8 days'),
             ('audio-kept', 'author', 'moment-audio/kept.mp3', 'kept.mp3', 'audio/mpeg', 100, 'ready', CURRENT_TIMESTAMP - INTERVAL '8 days');
      INSERT INTO drafts (id, user_id, kind, title, payload_json, created_at, updated_at)
      VALUES ('audio-kept-draft', 'author', 'shared', 'Kept', '{"audioUploadId":"audio-kept"}', '2026-01-01', '2026-01-01');
    `);
    let audioCleanupFails = true;
    const deletedAudio = [];
    const audioRetention = loadModule("app/api/cron/moment-audio/route.ts", {
      "@vercel/blob": { del: async (pathname) => {
        if (audioCleanupFails) throw new Error("storage unavailable");
        deletedAudio.push(pathname);
      } },
      "next/server": { connection: async () => {} },
      "@/lib/db": { getSql: () => sql },
    });
    process.env.CRON_SECRET = "test-secret";
    try {
      assert.equal((await audioRetention.GET(new Request("https://example.test/cron"))).status, 401);
      const request = () => new Request("https://example.test/cron", { headers: { Authorization: "Bearer test-secret" } });
      assert.equal((await audioRetention.GET(request())).status, 500);
      audioCleanupFails = false;
      assert.equal((await audioRetention.GET(request())).status, 204);
      assert.ok(deletedAudio.includes("moment-audio/own.mp3"));
      assert.ok(deletedAudio.includes("moment-audio/abandoned.mp3"));
      assert.equal(deletedAudio.includes("moment-audio/kept.mp3"), false);
    } finally {
      if (originalSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = originalSecret;
    }
  } finally {
    await db.close();
  }
});
