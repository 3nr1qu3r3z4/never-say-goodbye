import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
    Date,
  });
  return exports;
}

const ProfileLocations = loadModule("app/profile-locations.tsx", {
  "react/jsx-runtime": jsxRuntime,
}).default;

const MomentCard = loadModule("app/moments/moment-card.tsx", {
  "react/jsx-runtime": jsxRuntime,
  "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
  "./moment-actions-menu": { default: ({ momentId, isAuthor }) =>
    React.createElement("button", { "data-owner": String(isAuthor) }, `Actions for ${momentId}`) },
  "./video-preview": { default: ({ momentId }) => React.createElement("span", { "data-video": momentId }, "▶") },
}).default;

const profile = {
  id: "person", displayName: "Jane", bio: "", location: "Seattle",
  birthplace: "Boston", descriptorOne: "Kind", descriptorTwo: "",
  descriptorThree: "", profilePhoto: null, personalMotto: "",
  publicProfilePhoto: false, publicProfileBio: false, publicSharedMoments: false,
  publicPersonalMoments: false, publicConnectedLives: false,
  publicLegacyTree: false, publicFutureMomentMakers: false,
  discoverability: "public",
};

const basicDependencies = {
  "react/jsx-runtime": jsxRuntime,
  "next/link": { default: ({ children }) => React.createElement("a", null, children) },
  "next/image": { default: () => null },
  "@/app/profile-locations": { default: ProfileLocations },
  "@/app/moments/moment-card": { default: MomentCard },
  "@/lib/moment-access": { getPublicProfileSharedMoments: async () => [] },
  "@/lib/frequent-visits": { frequentVisitsEnabled: () => false },
  "./visit-tracker": { default: () => null },
};

test("saved profile photo uses the same square framing in editor, preview and public profile", async () => {
  const photo = "data:image/png;base64,c2F2ZWQtY3JvcA==";
  const image = ({ src, alt, className }) => React.createElement("img", { src, alt, className });
  const dependencies = { ...basicDependencies, "next/image": { default: image } };
  const editor = loadModule("app/my-profile/profile-editor.tsx", {
    ...dependencies,
    react: React,
    "@/app/actions/profile": { saveProfile: () => {}, saveProfilePhoto: () => {} },
    "@/lib/convert-image": { isHeicFile: () => false, toSupportedImage: () => {} },
  }).default;
  const editorHtml = renderToStaticMarkup(React.createElement(editor, { ...profile, profilePhoto: photo }));
  const editorFrame = editorHtml.match(/<div class="[^"]*aspect-square[^"]*">[\s\S]*?<\/div>/)?.[0];
  assert.ok(editorFrame);

  const sql = async (strings) => strings.join("").includes("FROM users AS u")
    ? [{ ...profile, profilePhoto: photo, publicProfilePhoto: true }]
    : [];
  const preview = loadModule("app/my-profile/preview/page.tsx", {
    ...dependencies,
    "@/lib/auth": { requireUser: async () => ({ id: "person" }) },
    "@/lib/db": { getSql: () => sql },
  }).default;
  const publicPage = loadModule("app/moment-maker/[id]/page.tsx", {
    ...dependencies,
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { getCurrentUser: async () => ({ id: "viewer" }) },
    "@/lib/db": { getSql: () => sql },
    "./connection-request-button": { default: () => null },
  }).default;
  const previewHtml = renderToStaticMarkup(await preview());
  const publicHtml = renderToStaticMarkup(await publicPage({ params: Promise.resolve({ id: "person" }) }));
  for (const html of [previewHtml, publicHtml]) {
    const frame = html.match(/<figure[^>]*>[\s\S]*?<\/figure>/)?.[0];
    assert.ok(frame);
    assert.match(frame, /class="[^"]*\baspect-square\b/);
    assert.doesNotMatch(frame, /aspect-\[/);
    assert.match(frame, /src="data:image\/png;base64,c2F2ZWQtY3JvcA=="[^>]*class="object-cover object-center"/);
  }
  assert.match(editorFrame, /src="data:image\/png;base64,c2F2ZWQtY3JvcA=="[^>]*class="object-cover object-center"/);
});

test("profile Shared Moments use the shared cards and respect profile visibility", async () => {
  let visible = true;
  let discoverability = "public";
  const sql = async (strings) => {
    const text = strings.join("");
    if (text.includes("FROM users AS u")) {
      return [{ ...profile, publicSharedMoments: visible, discoverability }];
    }
    return [];
  };
  const calls = [];
  const dependencies = {
    ...basicDependencies,
    "@/lib/moment-access": { getPublicProfileSharedMoments: async (viewer, author) => {
      calls.push([viewer, author]);
      return [
        { id: "photo", title: "Photo story", story: "", writtenMessage: null, hasPhoto: true, hasVideo: false, authorName: "Jane", isAuthor: viewer === author },
        { id: "video", title: "Family video", story: "", writtenMessage: null, hasPhoto: false, hasVideo: true, authorName: "Jane", isAuthor: viewer === author },
        { id: "text", title: "Text story", story: "A family memory.", writtenMessage: null, hasPhoto: false, hasVideo: false, authorName: "Jane", isAuthor: viewer === author },
      ];
    } },
    "@/lib/db": { getSql: () => sql },
  };
  for (const [currentUser, expected] of [[{ id: "person" }, "true"], [null, "false"]]) {
    const page = loadModule("app/moment-maker/[id]/page.tsx", {
      ...dependencies,
      "next/navigation": { notFound: () => { throw new Error("not found"); } },
      "@/lib/auth": { getCurrentUser: async () => currentUser },
      "./connection-request-button": { default: () => null },
    }).default;
    const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "person" }) }));
    assert.match(html, new RegExp(`data-owner="${expected}">Actions for photo`));
    assert.match(html, /href="\/moments\/photo"[\s\S]*?src="\/api\/moments\/photo\/photo"[\s\S]*?Photo story[\s\S]*?<\/a>/);
    assert.match(html, /href="\/moments\/video"[\s\S]*?data-video="video"[\s\S]*?Video Moment[\s\S]*?<\/a>/);
    assert.match(html, /href="\/moments\/text"[\s\S]*?A family memory\.[\s\S]*?<\/a>/);
  }
  const preview = loadModule("app/my-profile/preview/page.tsx", {
    ...dependencies,
    "@/lib/auth": { requireUser: async () => ({ id: "person" }) },
  }).default;
  const previewHtml = renderToStaticMarkup(await preview());
  assert.match(previewHtml, /data-owner="true">Actions for photo/);
  assert.match(previewHtml, /href="\/moments\/photo"[\s\S]*?src="\/api\/moments\/photo\/photo"[\s\S]*?Photo story[\s\S]*?<\/a>/);
  assert.match(previewHtml, /href="\/moments\/video"[\s\S]*?data-video="video"[\s\S]*?Video Moment[\s\S]*?<\/a>/);
  assert.match(previewHtml, /href="\/moments\/text"[\s\S]*?A family memory\.[\s\S]*?<\/a>/);
  assert.deepEqual(calls, [["person", "person"], [null, "person"], ["person", "person"]]);
  visible = false;
  assert.doesNotMatch(renderToStaticMarkup(await preview()), /Photo story/);
  visible = true;
  discoverability = "private";
  assert.doesNotMatch(renderToStaticMarkup(await preview()), /Photo story/);
});

test("profile preview displays each location only when its visibility is enabled", async () => {
  for (const [showBirth, showLocation] of [[false, false], [true, false], [false, true], [true, true]]) {
    const sql = async (strings) => strings.join("").includes("FROM users AS u")
      ? [{ ...profile, publicBirthplace: showBirth, publicLocation: showLocation }]
      : [];
    const page = loadModule("app/my-profile/preview/page.tsx", {
      ...basicDependencies,
      "@/lib/auth": { requireUser: async () => ({ id: "person" }) },
      "@/lib/db": { getSql: () => sql },
    }).default;
    const html = renderToStaticMarkup(await page());
    assert.equal(html.includes("Boston"), showBirth);
    assert.equal(html.includes("Seattle"), showLocation);
    if (showBirth) assert.ok(html.indexOf("Kind") < html.indexOf("Born In"));
    if (showLocation) assert.ok(html.indexOf("Kind") < html.indexOf("Lives In"));
  }
});

test("public profile displays enabled locations beneath the descriptors", async () => {
  for (const [showBirth, showLocation] of [[false, false], [true, false], [false, true], [true, true]]) {
    const sql = async (strings) => strings.join("").includes("FROM users AS u")
      ? [{ ...profile, birthplace: showBirth ? "Boston" : "", location: showLocation ? "Seattle" : "" }]
      : [];
    const page = loadModule("app/moment-maker/[id]/page.tsx", {
      ...basicDependencies,
      "next/navigation": { notFound: () => { throw new Error("not found"); } },
      "@/lib/auth": { getCurrentUser: async () => null },
      "@/lib/db": { getSql: () => sql },
      "./connection-request-button": { default: () => null },
    }).default;
    const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "person" }) }));
    assert.equal(html.includes("Boston"), showBirth);
    assert.equal(html.includes("Seattle"), showLocation);
    if (showBirth) assert.ok(html.indexOf("Kind") < html.indexOf("Born In"));
    if (showLocation) assert.ok(html.indexOf("Kind") < html.indexOf("Lives In"));
  }
});

test("empty or whitespace locations do not create empty labels", () => {
  const html = renderToStaticMarkup(React.createElement(ProfileLocations, {
    birthplace: " ", location: "",
  }));
  assert.equal(html, "");
});

test("public profile and search queries suppress disabled values before rendering", async () => {
  const publicQueries = [];
  const sql = async (strings) => {
    const text = strings.join("?");
    publicQueries.push(text);
    return text.includes("FROM users AS u")
      ? [{ ...profile, birthplace: "", location: "" }]
      : [];
  };
  const page = loadModule("app/moment-maker/[id]/page.tsx", {
    ...basicDependencies,
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { getCurrentUser: async () => null },
    "@/lib/db": { getSql: () => sql },
    "./connection-request-button": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "person" }) }));
  assert.doesNotMatch(html, /Boston|Seattle/);
  assert.match(publicQueries[0], /CASE WHEN u\.public_birthplace THEN COALESCE\(u\.birthplace, ''\) ELSE '' END AS birthplace/);
  assert.match(publicQueries[0], /CASE WHEN u\.public_location THEN COALESCE\(u\.location, ''\) ELSE '' END AS location/);

  const searchQueries = [];
  const search = loadModule("app/search/page.tsx", {
    ...basicDependencies,
    "@/lib/auth": { getCurrentUser: async () => null },
    "@/lib/moment-access": { searchAccessibleMoments: async () => [] },
    "@/lib/legacy-search": { searchOwnedLegacy: async () => ({ trees: [], futureMakers: [], drafts: [] }) },
    "@/app/moments/moment-card": { default: () => null },
    "@/lib/db": { getSql: () => async (strings) => {
      searchQueries.push(strings.join("?"));
      return [];
    } },
    "./search-form": { default: () => null },
  }).default;
  await search({ searchParams: Promise.resolve({ name: "Jane" }) });
  assert.match(searchQueries[0], /CASE WHEN u\.public_location THEN COALESCE\(u\.location, ''\) ELSE '' END AS location/);
});

test("owners receive their actual location values independently of visitor settings", async () => {
  const page = loadModule("app/my-profile/page.tsx", {
    ...basicDependencies,
    "@/lib/auth": { requireUser: async () => ({ id: "person", displayName: "Jane" }) },
    "@/lib/db": { getSql: () => async () => [profile] },
    "@/lib/successor": { canManageSuccessor: async () => false },
    "./profile-editor": { default: ({ birthplace, location }) =>
      React.createElement(ProfileLocations, { birthplace, location }) },
    "./appearance": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Boston/);
  assert.match(html, /Seattle/);
});

test("Legacy Controls save both visibility settings for the authenticated user", async () => {
  for (const [showBirth, showLocation] of [[false, false], [true, false], [false, true], [true, true]]) {
    const calls = [];
    const actions = loadModule("app/actions/legacy-controls.ts", {
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": { redirect: () => {} },
      "@/lib/auth": { requireUser: async () => ({ id: "person" }) },
      "@/lib/db": { getSql: () => async (strings, ...values) =>
        calls.push({ text: strings.join("?"), values }) },
    });
    const data = new FormData();
    data.set("discoverability", "public");
    data.set("treeParticipation", "owner");
    if (showBirth) data.set("publicBirthplace", "on");
    if (showLocation) data.set("publicLocation", "on");
    await actions.saveLegacyControls(data);
    assert.match(calls[0].text, /public_birthplace = \?,\s*public_location = \?/);
    assert.deepEqual(calls[0].values.slice(4, 6), [showBirth, showLocation]);
    assert.equal(calls[0].values.at(-1), "person");
  }
});
