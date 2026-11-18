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
};

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
    "./profile-editor": { default: ({ birthplace, location }) =>
      React.createElement(ProfileLocations, { birthplace, location }) },
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
