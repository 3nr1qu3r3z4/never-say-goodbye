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

function loadComponent(sql) {
  const source = fs.readFileSync(path.join(root, "app/weekly-moment-makers.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const errors = [];
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/server": { connection: async () => {} },
    "@/lib/db": { getSql: () => sql },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
    console: { error: (...args) => errors.push(args) },
  });
  return { component: exports.default, errors };
}

test("weekly cards display returned profile fields and link to the profile", async () => {
  let query = "";
  const { component } = loadComponent(async (strings) => {
    query = strings.join("");
    return [{
      id: "member /1", displayName: "Example Member", descriptorOne: "Parent",
      descriptorTwo: "Artist", descriptorThree: "Friend", location: "Example City",
      profilePhoto: "data:image/png;base64,abc",
    }];
  });
  const html = renderToStaticMarkup(await component());
  assert.match(query, /get_weekly_moment_makers\(\)/);
  assert.match(html, /Example Member/);
  assert.match(html, /Parent · Artist · Friend/);
  assert.match(html, /Example City/);
  assert.match(html, /data:image\/png;base64,abc/);
  assert.match(html, /\/moment-maker\/member%20%2F1/);
  assert.match(html, /<ul[^>]*aria-labelledby="weekly-moment-makers-heading"[^>]*tabindex="0"[^>]*class="[^"]*flex[^"]*overflow-x-auto/);
});

test("empty selections and database errors are distinguished", async () => {
  const empty = loadComponent(async () => []);
  assert.match(renderToStaticMarkup(await empty.component()), /No profiles are featured this week/);

  const failure = loadComponent(async () => { throw new Error("database unavailable"); });
  assert.match(renderToStaticMarkup(await failure.component()), /Featured profiles are temporarily unavailable/);
  assert.equal(failure.errors.length, 1);
});
