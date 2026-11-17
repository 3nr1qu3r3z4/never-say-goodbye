import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
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

function createActions(rows = []) {
  const calls = [];
  const relationships = loadModule("lib/connected-lives.ts");
  const actions = loadModule("app/actions/connected-lives.ts", {
    "node:crypto": { randomUUID: () => "notification-id" },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/auth": {
      requireUser: async () => ({ id: "recipient", displayName: "Recipient" }),
    },
    "@/lib/db": {
      getSql: () => async (strings, ...values) => {
        calls.push({ text: strings.join("?"), values });
        return rows;
      },
    },
    "@/lib/connected-lives": relationships,
  });
  return { actions, calls };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("acceptance requires a supported relationship before writing", async () => {
  for (const relationshipType of [undefined, "friend"]) {
    const { actions, calls } = createActions();
    const values = { requestId: "connection", response: "accept" };
    if (relationshipType) values.relationshipType = relationshipType;
    const result = await actions.respondToConnectedLivesRequest({}, form(values));
    assert.equal(result.error, "Choose how you know this person.");
    assert.equal(calls.length, 0);
  }
});

test("acceptance stores each type only for the pending recipient", async () => {
  for (const relationshipType of ["family", "close_friend", "mentor", "other"]) {
    const { actions, calls } = createActions([{ requesterId: "requester" }]);
    const result = await actions.respondToConnectedLivesRequest(
      {},
      form({ requestId: "connection", response: "accept", relationshipType }),
    );
    assert.equal(result.status, "connected");
    assert.ok(calls[0].values.includes(relationshipType));
    assert.match(calls[0].text, /connected_user_id = \?/);
    assert.match(calls[0].text, /status = 'pending'/);
    assert.match(calls[0].text, /EXISTS \(SELECT 1 FROM responded\)/);
  }
});

test("declining requires no relationship type", async () => {
  const { actions, calls } = createActions([{ requesterId: "requester" }]);
  const result = await actions.respondToConnectedLivesRequest(
    {},
    form({ requestId: "connection", response: "decline" }),
  );
  assert.equal(result.status, "none");
  assert.ok(calls[0].values.includes(null));
});

test("relationship editing rejects invalid input and unavailable connections", async () => {
  const { actions, calls } = createActions();
  const invalid = await actions.updateConnectedLivesRelationship(
    {},
    form({ connectionId: "connection", relationshipType: "friend" }),
  );
  assert.equal(invalid.error, "Choose a valid relationship type.");
  assert.equal(calls.length, 0);

  const unavailable = await actions.updateConnectedLivesRelationship(
    {},
    form({ connectionId: "connection", relationshipType: "family" }),
  );
  assert.equal(unavailable.error, "This connection is no longer available to update.");
  assert.match(calls[0].text, /status = 'accepted'/);
  assert.match(calls[0].text, /owner_user_id = \? OR connected_user_id = \?/);
});

test("editing passes a valid type to an accepted participant's connection", async () => {
  for (const relationshipType of ["family", "close_friend", "mentor", "other"]) {
    const { actions, calls } = createActions([{ id: "connection" }]);
    const result = await actions.updateConnectedLivesRelationship(
      {},
      form({ connectionId: "connection", relationshipType }),
    );
    assert.equal(result.message, "Relationship updated.");
    assert.ok(calls[0].values.includes(relationshipType));
    assert.match(calls[0].text, /status = 'accepted'/);
    assert.match(calls[0].text, /owner_user_id = \? OR connected_user_id = \?/);
  }
});
