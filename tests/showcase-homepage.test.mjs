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

function loadPage(relativePath, user = null, overrides = {}, globals = {}) {
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
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/app/actions/auth": { logoutAction: () => {} },
    "./weekly-moment-makers": { default: () => null },
    "./first-message": { default: () => null },
    "./protected-moment": { default: () => null },
    ...overrides,
  };
  vm.runInNewContext(compiled, {
    exports,
    ...globals,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports.default;
}

function renderPage(relativePath) {
  return renderToStaticMarkup(React.createElement(loadPage(relativePath)));
}

async function renderSuspendedActions(container) {
  const suspense = React.Children.toArray(container.props.children)
    .find((child) => React.isValidElement(child) && child.type === React.Suspense);
  assert.ok(suspense);
  return renderToStaticMarkup(await suspense.props.children.type());
}

test("homepage hero preserves guest actions and removes the signed-in duplicate", async () => {
  const renderHero = async (user) => {
    const page = loadPage(["app", "page.tsx"], user);
    return renderSuspendedActions(page().props.children[0]);
  };
  const guest = await renderHero(null);
  assert.match(guest, /href="\/signup"[^>]*>Create Your Legacy<\/a>/);
  assert.match(guest, /href="\/search"[^>]*>Find A Moment Maker<\/a>/);
  const signedIn = await renderHero({ id: "viewer" });
  assert.doesNotMatch(signedIn, /My Legacy|href="\/dashboard"|Create Your Legacy/);
  assert.match(signedIn, /href="\/search"[^>]*bg-\[#D8A35B\][^>]*>Find A Moment Maker<\/a>/);
});

test("signed-in primary navigation retains My Legacy and Sign Out", async () => {
  const navigation = loadPage(["app", "site-navigation.tsx"], { id: "viewer" });
  const html = await renderSuspendedActions(navigation().props.children);
  assert.match(html, /href="\/dashboard"[^>]*>My Legacy<\/a>/);
  assert.match(html, />Sign Out<\/button>/);
});

test("the homepage showcase link opens John's profile without the message fragment", () => {
  const html = renderPage(["app", "page.tsx"]);
  assert.match(html, /<a href="\/profile-preview"[^>]*>See Sample Profile<\/a>/);
  assert.doesNotMatch(html, /profile-preview#first-message/);
});

test("homepage and showcase footers link the site name to the homepage", () => {
  for (const relativePath of [["app", "page.tsx"], ["app", "profile-preview", "page.tsx"]]) {
    const html = renderPage(relativePath);
    assert.match(html, /<footer\b[^>]*>[\s\S]*?<a href="\/"[^>]*>Never Say Goodbye<\/a>[\s\S]*?<\/footer>/);
  }
});

test("the showcase tree link targets John's tree, not the viewer's tree", () => {
  const html = renderPage(["app", "profile-preview", "page.tsx"]);
  assert.match(html, /<a href="\/profile-preview#family-tree-heading"[^>]*>🌳 View Legacy Tree™<\/a>/);
  assert.match(html, /<h2 id="family-tree-heading"[^>]*>John&#x27;s Legacy Tree™<\/h2>/);
  assert.doesNotMatch(html, /href="\/legacy-tree(?:[?#][^"]*)?"/);
});

test("showcase labels fictional tree and visited profiles and distinguishes future grandchildren", () => {
  const html = renderPage(["app", "profile-preview", "page.tsx"]);
  assert.match(html, /Illustrative example: actual Legacy Trees show membership, not inferred generations/);
  assert.match(html, />Frequently Visited<\/h2>/);
  assert.match(html, /A fictional example of a shortcut/);
  assert.doesNotMatch(html, /Most Visited/);
  assert.match(html, />Future Grandchild 1<\/p>/);
  assert.match(html, />Future Grandchild 2<\/p>/);
});

test("first message does not advertise a duration without a recording", () => {
  const html = renderPage(["app", "profile-preview", "first-message.tsx"]);
  assert.match(html, /This example does not have a recording yet/);
  assert.doesNotMatch(html, /Duration:/);
});

test("Escape closes a protected moment and clears its entered code and error", () => {
  const state = [true, "wrong", true, false];
  let stateIndex = 0;
  let listener;
  let cleanup;
  const window = {
    addEventListener(type, handler) {
      assert.equal(type, "keydown");
      listener = handler;
    },
    removeEventListener(type, handler) {
      assert.equal(type, "keydown");
      assert.equal(handler, listener);
      listener = undefined;
    },
  };
  const hooks = {
    useState() {
      const index = stateIndex++;
      return [state[index], (value) => { state[index] = value; }];
    },
    useCallback(callback) { return callback; },
    useEffect(effect) { cleanup = effect(); },
  };
  const component = loadPage(
    ["app", "profile-preview", "protected-moment.tsx"],
    null,
    { react: hooks },
    { window },
  );
  component({ title: "Example" });
  listener({ key: "Enter" });
  assert.deepEqual(state, [true, "wrong", true, false]);
  listener({ key: "Escape" });
  assert.deepEqual(state, [false, "", false, false]);
  cleanup();
  assert.equal(listener, undefined);
});
