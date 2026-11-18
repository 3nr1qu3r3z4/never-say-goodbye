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
  });
  return exports;
}

test("signup requires terms and the existing visibility agreement on the server", async () => {
  let queries = 0;
  const actions = loadModule("app/actions/auth.ts", {
    "node:crypto": { randomUUID: () => "id" },
    "next/navigation": { redirect: () => {} },
    "@/lib/auth": { createSession: async () => {}, deleteCurrentSession: async () => {} },
    "@/lib/db": { getSql: () => async () => { queries++; return [{ id: "existing" }]; } },
    "@/lib/password": { hashSecret: async () => "", verifySecret: async () => false },
    "@/lib/account-validation": loadModule("lib/account-validation.ts"),
  });
  const data = new FormData();
  for (const [key, value] of Object.entries({
    firstName: "Jane", lastName: "Doe", email: "jane@example.test",
    username: "jane_doe", password: "password1", confirmPassword: "password1",
    displayStyle: "full-name", membership: "free", discoverability: "private",
    visibilityAcknowledgment: "on",
  })) data.set(key, value);

  assert.match((await actions.signupAction({}, data)).error, /accept both agreements/);
  assert.equal(queries, 0);
  data.set("terms", "on");
  data.delete("visibilityAcknowledgment");
  assert.match((await actions.signupAction({}, data)).error, /accept both agreements/);
  assert.equal(queries, 0);
  data.set("visibilityAcknowledgment", "on");
  assert.match((await actions.signupAction({}, data)).error, /already exists/);
  assert.equal(queries, 1);
});
