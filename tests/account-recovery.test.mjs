import assert from "node:assert/strict";
import * as crypto from "node:crypto";
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
    console,
  });
  return exports;
}

function createHarness() {
  const state = {
    attempts: new Set(),
    tokenHash: null,
    expired: false,
    passwordHash: "old",
    sessions: 1,
    emails: [],
    queries: [],
  };
  const sql = async (strings, ...values) => {
    const query = strings.join("?");
    state.queries.push(query);
    if (query.includes("INSERT INTO account_recovery_attempts")) {
      const key = `${values[0]}:${values[1]}`;
      if (state.attempts.has(key)) return [];
      state.attempts.add(key);
      return [{ email_hash: values[0] }];
    }
    if (query.includes("SELECT id, email, username")) {
      return values[0] === "person@example.test"
        ? [{ id: "user-1", email: values[0], username: "person_1" }]
        : [];
    }
    if (query.includes("INSERT INTO password_reset_tokens")) {
      state.tokenHash = values[1];
      state.expired = false;
      return [];
    }
    if (query.includes("SELECT user_id FROM password_reset_tokens")) {
      return values[0] === state.tokenHash && !state.expired
        ? [{ user_id: "user-1" }]
        : [];
    }
    if (query.includes("WITH consumed AS")) {
      assert.match(query, /DELETE FROM password_reset_tokens/);
      assert.match(query, /expires_at > CURRENT_TIMESTAMP/);
      assert.match(query, /DELETE FROM sessions/);
      if (values[0] !== state.tokenHash || state.expired) return [];
      state.tokenHash = null;
      state.passwordHash = values[1];
      state.sessions = 0;
      return [{ id: "user-1" }];
    }
    throw new Error("Unexpected query");
  };
  const validation = loadModule("lib/account-validation.ts");
  const actions = loadModule("app/actions/account-recovery.ts", {
    "node:crypto": crypto,
    "@/lib/db": { getSql: () => sql },
    "@/lib/password": { hashSecret: async (password) => `hashed:${password}` },
    "@/lib/account-validation": validation,
    "@/lib/recovery-email": {
      getRecoveryConfig: () => ({
        origin: "https://example.test",
        rateLimitSecret: "a".repeat(32),
      }),
      sendRecoveryEmail: async (_config, to, subject, text) => {
        state.emails.push({ to, subject, text });
      },
    },
  });
  return { actions, state };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("username recovery sends the username without revealing unknown accounts", async () => {
  const { actions, state } = createHarness();
  const known = await actions.recoverUsername({}, form({ email: "PERSON@example.test" }));
  const unknown = await actions.recoverUsername({}, form({ email: "missing@example.test" }));
  assert.equal(known.message, "Username recovery instructions have been sent.");
  assert.equal(unknown.message, known.message);
  assert.equal(state.emails.length, 1);
  assert.match(state.emails[0].text, /person_1/);
});

test("reset tokens are hashed, single-use, and revoke sessions", async () => {
  const { actions, state } = createHarness();
  const request = await actions.recoverPassword({}, form({ email: "person@example.test" }));
  assert.equal(request.message, "Password reset instructions have been sent.");
  const token = state.emails[0].text.match(/#token=([A-Za-z0-9_-]+)/)[1];
  assert.equal(token.length, 43);
  assert.equal(state.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
  assert.notEqual(state.tokenHash, token);
  assert.ok(state.queries.some((query) => query.includes("INTERVAL '30 minutes'")));

  const invalid = await actions.resetPassword(
    {},
    form({ token, password: "new-password", confirmPassword: "different" }),
  );
  assert.equal(invalid.error, "Your passwords do not match.");
  assert.notEqual(state.tokenHash, null);

  const values = { token, password: "new-password", confirmPassword: "new-password" };
  const result = await actions.resetPassword({}, form(values));
  assert.equal(result.message, "Your password has been reset. You can now sign in.");
  assert.equal(state.passwordHash, "hashed:new-password");
  assert.equal(state.sessions, 0);
  const replay = await actions.resetPassword({}, form(values));
  assert.equal(replay.error, "This reset link is invalid or has expired.");
});

test("expired tokens cannot reset a password", async () => {
  const { actions, state } = createHarness();
  await actions.recoverPassword({}, form({ email: "person@example.test" }));
  const token = state.emails[0].text.match(/#token=([A-Za-z0-9_-]+)/)[1];
  state.expired = true;
  const result = await actions.resetPassword(
    {},
    form({ token, password: "new-password", confirmPassword: "new-password" }),
  );
  assert.equal(result.error, "This reset link is invalid or has expired.");
  assert.equal(state.passwordHash, "old");
  assert.equal(state.sessions, 1);
});

test("concurrent uses of a reset token cannot both succeed", async () => {
  const { actions, state } = createHarness();
  await actions.recoverPassword({}, form({ email: "person@example.test" }));
  const token = state.emails[0].text.match(/#token=([A-Za-z0-9_-]+)/)[1];
  const values = { token, password: "new-password", confirmPassword: "new-password" };
  const results = await Promise.all([
    actions.resetPassword({}, form(values)),
    actions.resetPassword({}, form(values)),
  ]);
  assert.equal(results.filter((result) => result.message).length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  assert.equal(state.sessions, 0);
});

test("repeated requests are throttled without revealing account existence", async () => {
  const { actions, state } = createHarness();
  const first = await actions.recoverPassword({}, form({ email: "person@example.test" }));
  const repeated = await actions.recoverPassword({}, form({ email: "person@example.test" }));
  assert.equal(repeated.message, first.message);
  assert.equal(state.emails.length, 1);
});

test("existing email and new username both work as login identifiers", async () => {
  const validation = loadModule("lib/account-validation.ts");
  for (const identifier of ["PERSON@example.test", "PERSON_1"]) {
    const calls = [];
    let sessionUser = null;
    const actions = loadModule("app/actions/auth.ts", {
      "node:crypto": crypto,
      "next/navigation": {
        redirect: (destination) => {
          assert.equal(destination, "/dashboard");
          throw new Error("redirect");
        },
      },
      "@/lib/auth": {
        createSession: async (id) => { sessionUser = id; },
        deleteCurrentSession: async () => {},
      },
      "@/lib/db": {
        getSql: () => async (strings, ...values) => {
          calls.push({ text: strings.join("?"), values });
          return [{ id: "user-1", passwordHash: "stored" }];
        },
      },
      "@/lib/password": {
        hashSecret: async () => "stored",
        verifySecret: async (password, hash) => password === "password" && hash === "stored",
      },
      "@/lib/account-validation": validation,
      "@/lib/site-analytics": { attributeSignup: async () => {} },
    });
    await assert.rejects(
      actions.loginAction({}, form({ identifier, password: "password" })),
      /redirect/,
    );
    assert.equal(sessionUser, "user-1");
    assert.match(calls[0].text, /LOWER\(email\).*OR LOWER\(username\)/);
    assert.ok(calls[0].values.every((value) => value === identifier.toLowerCase()));
  }
});
