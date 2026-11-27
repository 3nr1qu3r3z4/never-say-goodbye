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

function loadSearch(user, results, calls) {
  const source = fs.readFileSync(path.join(root, "app", "search", "page.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/image": { default: () => null },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => async () => results.people ?? [] },
    "@/lib/moment-access": { searchAccessibleMoments: async (...args) => { calls.push(["moments", ...args]); return results.moments ?? []; } },
    "@/lib/legacy-search": { searchOwnedLegacy: async (...args) => { calls.push(["legacy", ...args]); return results.legacy; } },
    "@/app/moments/moment-card": { default: ({ moment }) => React.createElement("li", null, moment.title) },
    "./search-form": { default: () => React.createElement("form", { action: "/search" }, "Search form") },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports.default;
}

test("legacy search shows scoped result categories and existing destination links", async () => {
  const calls = [];
  const page = loadSearch({ id: "owner" }, {
    people: [{ id: "person", displayName: "Jane", bio: "", location: "", descriptorOne: "", descriptorTwo: "", descriptorThree: "" }],
    moments: [{ id: "moment", title: "Shared memory" }],
    legacy: {
      trees: [{ id: "tree/id", name: "Family tree" }],
      futureMakers: [{ id: "future/id", name: "Future person" }],
      drafts: [{ id: "draft/id", title: "Family draft" }],
    },
  }, calls);
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ name: " Family " }) }));
  assert.deepEqual(calls, [["moments", "owner", "Family"], ["legacy", "owner", "Family"]]);
  assert.match(html, /People[\s\S]*Jane/);
  assert.match(html, /Shared Moments[\s\S]*Shared memory/);
  assert.match(html, /href="\/legacy-tree#legacy-tree-item-tree%2Fid"[^>]*>Family tree/);
  assert.match(html, /href="\/future-moment-maker\/future%2Fid"[^>]*>Future person/);
  assert.match(html, /href="\/drafts#draft-draft%2Fid"[^>]*>Family draft/);
  assert.doesNotMatch(html, /No results found/);
});

test("guest and empty searches never request private categories", async () => {
  const calls = [];
  const page = loadSearch(null, {}, calls);
  const emptyResults = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ name: "Jane" }) }));
  assert.match(emptyResults, /No results found/);
  await page({ searchParams: Promise.resolve({}) });
  assert.deepEqual(calls, []);
});
