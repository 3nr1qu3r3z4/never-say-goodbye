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
    Buffer,
  });
  return exports;
}

const profile = {
  displayName: "Jane Doe", discoverability: "private",
  descriptorOne: "Kind", descriptorTwo: "Curious", descriptorThree: "Patient",
  birthplace: "Boston", location: "Seattle", personalMotto: "Be kind",
};

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function createActions(authenticated = true, userExists = true) {
  const queries = [];
  const actions = loadModule("app/actions/profile.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/auth": {
      requireUser: async () => {
        if (!authenticated) throw new Error("Not authenticated");
        return { id: "user-1" };
      },
    },
    "@/lib/db": {
      getSql: () => async (strings, ...values) => {
        queries.push({ text: strings.join("?"), values });
        return userExists ? [{ id: "user-1" }] : [];
      },
    },
  });
  return { actions, queries };
}

test("profile setup is prefilled with all requested fields and visibility", () => {
  const components = loadModule("app/my-profile/setup/profile-setup-form.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "next/link": { default: (props) => React.createElement("a", props) },
    "@/app/actions/profile": { saveProfileSetup: async () => ({}) },
  });
  const html = renderToStaticMarkup(React.createElement(components.default, { profile }));
  for (const [field, value] of Object.entries(profile)) {
    assert.match(html, new RegExp(`name="${field}"`));
    assert.match(html, new RegExp(`value="${value}"`));
  }
  const privateOption = html.match(/<input[^>]*value="private"[^>]*>/)?.[0];
  assert.ok(privateOption);
  assert.match(privateOption, /checked=""/);
});

test("saving setup updates only the signed-in user's requested fields", async () => {
  const { actions, queries } = createActions();
  const result = await actions.saveProfileSetup(form(profile));
  assert.equal(result.success, "Your profile setup has been saved.");
  assert.equal(queries.length, 1);
  const query = queries[0];
  for (const value of Object.values(profile)) assert.ok(query.values.includes(value));
  assert.match(query.text, /WHERE id = \?/);
  assert.equal(query.values.at(-1), "user-1");
  assert.match(query.text, /birthplace = \?/);
  assert.doesNotMatch(query.text, /(?:profile_photo_data|public_profile_bio|featured)\s*=/);
});

test("invalid setup data and unauthenticated requests cannot write", async () => {
  for (const invalid of [
    { displayName: " " },
    { descriptorOne: "x".repeat(41) },
    { birthplace: "x".repeat(121) },
    { location: "x".repeat(121) },
    { personalMotto: "x".repeat(121) },
    { discoverability: "everyone" },
  ]) {
    const { actions, queries } = createActions();
    const result = await actions.saveProfileSetup(form({ ...profile, ...invalid }));
    assert.ok(result.error);
    assert.equal(queries.length, 0);
  }
  const { actions, queries } = createActions(false);
  await assert.rejects(actions.saveProfileSetup(form(profile)), /Not authenticated/);
  assert.equal(queries.length, 0);
});

test("optional setup values can be cleared without affecting other profile fields", async () => {
  const { actions, queries } = createActions();
  const result = await actions.saveProfileSetup(form({
    ...profile, birthplace: " ", location: "", personalMotto: "",
  }));
  assert.ok(result.success);
  assert.deepEqual(queries[0].values.slice(4, 7), [null, null, null]);
});

test("saving reports an error if the profile no longer exists", async () => {
  const { actions } = createActions(true, false);
  const result = await actions.saveProfileSetup(form(profile));
  assert.match(result.error, /profile could not be found/);
});
