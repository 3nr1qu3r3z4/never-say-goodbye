import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
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

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function createActions(treeExists = true, existingAlreadyAdded = false) {
  const calls = [];
  const actions = loadModule("app/actions/family-tree.ts", {
    "node:crypto": { randomUUID: () => "placeholder-id" },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: () => { throw new Error("redirect"); } },
    "@/lib/auth": { getCurrentUser: async () => ({ id: "author" }) },
    "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
    "@/lib/db": {
      getSql: () => async (strings, ...values) => {
        const text = strings.join("?");
        calls.push({ text, values });
        if (text.includes("SELECT lt.id")) return treeExists ? [{ id: "tree" }] : [];
        if (text.includes("SELECT id") && text.includes("FROM users")) return [{ id: "relative" }];
        if (text.includes("RETURNING user_id")) return existingAlreadyAdded ? [] : [{ user_id: "relative" }];
        return [];
      },
    },
  });
  return { actions, calls };
}

test("tree members can add a placeholder with optional fields omitted", async () => {
  const { actions, calls } = createActions();
  const result = await actions.addFamilyMember({}, form({
    treeId: "tree",
    memberType: "placeholder",
    name: "  Grandmother  ",
    relationship: "  Grandmother  ",
  }));
  assert.match(result.success, /Family Placeholder added/);
  assert.equal(result.treeId, "tree");
  assert.match(calls[0].text, /ltm\.user_id = \?/);
  assert.match(calls[1].text, /INSERT INTO family_placeholders/);
  assert.deepEqual(calls[1].values.slice(0, 9), [
    "placeholder-id", "tree", "author", "Grandmother", "Grandmother",
    null, null, null, calls[1].values[8],
  ]);
  assert.equal(calls.length, 2);
});

test("successful additions identify the selected tree and duplicate members are reported accurately", async () => {
  const { actions } = createActions();
  for (const values of [
    { memberType: "existing", existingUserId: "relative" },
    { memberType: "future", name: "Future Relative" },
  ]) {
    const result = await actions.addFamilyMember({}, form({
      treeId: "tree", relationship: "Family", ...values,
    }));
    assert.match(result.success, /added/);
    assert.equal(result.treeId, "tree");
  }
  const duplicate = createActions(true, true);
  const result = await duplicate.actions.addFamilyMember({}, form({
    treeId: "tree", memberType: "existing", existingUserId: "relative", relationship: "Family",
  }));
  assert.match(result.success, /already in this Legacy Tree/);
  assert.equal(result.treeId, "tree");
});

test("placeholder creation rejects outsiders and invalid years", async () => {
  const base = {
    treeId: "tree", memberType: "placeholder", name: "Relative",
    relationship: "Parent",
  };
  const outsider = createActions(false);
  const denied = await outsider.actions.addFamilyMember({}, form(base));
  assert.match(denied.error, /tree you belong to/);
  assert.equal(outsider.calls.length, 1);

  for (const years of [
    { birthYear: "999" },
    { birthYear: "1950", deathYear: "1949" },
  ]) {
    const { actions, calls } = createActions();
    const result = await actions.addFamilyMember({}, form({ ...base, ...years }));
    assert.ok(result.error);
    assert.equal(calls.length, 1);
  }
});

test("placeholder years and notes are stored when provided", async () => {
  const { actions, calls } = createActions();
  const result = await actions.addFamilyMember({}, form({
    treeId: "tree", memberType: "placeholder", name: "Relative",
    relationship: "Parent", birthYear: "1942", deathYear: "2018",
    notes: "  A family story  ",
  }));
  assert.ok(result.success);
  assert.deepEqual(calls[1].values.slice(5, 8), [1942, 2018, "A family story"]);
});

test("skipping placeholder details does not save previously entered values", async () => {
  const { actions, calls } = createActions();
  const result = await actions.addFamilyMember({}, form({
    treeId: "tree", memberType: "placeholder", name: "Relative", relationship: "Parent",
    birthYear: "invalid", deathYear: "1900", notes: "Not saved", skipDetails: "yes",
  }));
  assert.ok(result.success);
  assert.deepEqual(calls[1].values.slice(5, 8), [null, null, null]);
});

test("account search is authenticated and restricted to searchable profiles", async () => {
  const { actions, calls } = createActions();
  assert.ok((await actions.searchFamilyMomentMakers(" ")).error);
  assert.equal(calls.length, 0);
  await actions.searchFamilyMomentMakers("  Jane%  ");
  assert.match(calls[0].text, /discoverability IN \('searchable', 'public'\)/);
  assert.match(calls[0].text, /strpos\(lower\(display_name\), lower\(\?\)\)/);
  assert.deepEqual(calls[0].values, ["author", "Jane%"]);
  const signedOut = loadModule("app/actions/family-tree.ts", {
    "node:crypto": { randomUUID: () => "" },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/auth": { getCurrentUser: async () => null },
    "@/lib/db": { getSql: () => { throw new Error("must not query"); } },
  });
  assert.match((await signedOut.searchFamilyMomentMakers("Jane")).error, /Sign in/);
});

test("publishing links only an accessible placeholder and preserves audience", async () => {
  async function publish(available) {
    const calls = [];
    const sql = (strings, ...values) => {
      const text = strings.join("?");
      calls.push({ text, values });
      return text.includes("SELECT fp.id") && available ? [{ id: "relative" }] : [];
    };
    sql.transaction = async () => [];
    const actions = loadModule("lib/moment-actions.ts", {
      "node:crypto": { randomUUID: () => "moment-id" },
      "@/lib/auth": { getCurrentUser: async () => ({ id: "author" }) },
      "@/lib/db": { getSql: () => sql },
      "@/lib/password": { hashSecret: async () => "hash" },
      "@/lib/profile-photo": { validatePhoto: (value) => value },
      "@/lib/cannot-open-until": { cannotOpenUntilEnabled: () => false },
      "@/lib/time-capsule-schedule": loadModule("lib/time-capsule-schedule.ts", {}),
    });
    const result = await actions.publishMoment("shared", "", {
      title: "A story", story: "A memory", tags: "", content: ["written"],
      attachmentNames: {}, photoData: "", videoUploadId: "", writtenMessage: "", audience: "family",
      accessCodeRequired: false, accessCode: "", releaseKind: "date",
      releaseDate: "", occasion: "", customOccasionDate: "", recipientName: "",
      relationship: "", createRecipient: false, familyPlaceholderId: "relative",
    });
    return { result, calls };
  }

  const denied = await publish(false);
  assert.match(denied.result.error, /not available in your tree/);
  assert.equal(denied.calls.length, 1);
  assert.match(denied.calls[0].text, /ltm\.user_id = \?/);

  const allowed = await publish(true);
  assert.equal(allowed.result.success, true);
  assert.match(allowed.calls[1].text, /INSERT INTO moments/);
  assert.ok(allowed.calls[1].values.includes("relative"));
  assert.ok(allowed.calls[1].values.includes("family"));
});

test("linked story query stays author-only and withholds protected content", async () => {
  const queries = [];
  const sql = (strings, ...values) => {
    const query = { text: strings.join("?"), values };
    queries.push(query);
    return query;
  };
  sql.transaction = async () => [[], [], [], [], [], []];
  const jsx = (type, props) => ({ type, props });
  const components = loadModule("app/legacy-tree/family-members.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { Fragment: Symbol.for("react.fragment") },
    "next/link": { default: () => null },
    "next/image": { default: () => null },
    "@/app/actions/family-tree": { createLegacyTree: async () => {} },
    "@/lib/auth": { getCurrentUser: async () => ({ id: "author" }) },
    "@/lib/db": { getSql: () => sql },
    "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
    "./family-member-form": { default: () => null },
    "./family-date-link": { default: () => null },
    "./print-tree-button": { default: () => null },
    "./tree-milestones-panel": { default: () => null },
  });
  const userSection = await components.default();
  await userSection.type(userSection.props);
  const linked = queries.find((query) => query.text.includes("FROM moments"));
  assert.ok(linked.values.includes("author"));
  assert.match(linked.text, /WHERE user_id = \?/);
  assert.match(linked.text, /access_code_hash IS NULL AND kind <> 'cannot-open-until'/);
  assert.match(linked.text, /details_json::jsonb ->> 'writtenMessage'/);
});
