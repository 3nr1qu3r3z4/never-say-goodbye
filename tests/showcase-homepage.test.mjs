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

function renderPage(relativePath) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const source = fs.readFileSync(path.join(root, ...relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/image": { default: () => null },
    "@/lib/auth": { getCurrentUser: async () => null },
    "./weekly-moment-makers": { default: () => null },
    "./first-message": { default: () => null },
    "./protected-moment": { default: () => null },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return renderToStaticMarkup(React.createElement(exports.default));
}

test("the homepage showcase link opens John's profile without the message fragment", () => {
  const html = renderPage(["app", "page.tsx"]);
  assert.match(html, /<a href="\/profile-preview"[^>]*>See Sample Profile<\/a>/);
  assert.doesNotMatch(html, /profile-preview#first-message/);
});

test("the showcase tree link targets John's tree, not the viewer's tree", () => {
  const html = renderPage(["app", "profile-preview", "page.tsx"]);
  assert.match(html, /<a href="\/profile-preview#family-tree-heading"[^>]*>🌳 View Legacy Tree™<\/a>/);
  assert.match(html, /<h2 id="family-tree-heading"[^>]*>John&#x27;s Legacy Tree™<\/h2>/);
  assert.doesNotMatch(html, /href="\/legacy-tree(?:[?#][^"]*)?"/);
});
