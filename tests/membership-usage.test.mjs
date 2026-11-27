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
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
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

const Usage = loadModule("app/my-profile/membership/usage-summary.tsx", { "react/jsx-runtime": jsxRuntime }).default;

function quota(current, planLimit) {
  return { current, planLimit, planRemaining: null, effectiveLimit: planLimit, effectiveRemaining: null, wouldExceedOnAdd: false };
}

function report(betaAccess = "not-grandfathered") {
  return {
    plan: "legacy-plus", legacyMembership: null, betaAccess, enforcementEnabled: false,
    photos: quota(79, 100), stories: quota(80, 100), audioMoments: quota(94, 100),
    futureMomentMakers: quota(95, 100), cannotOpenUntil: quota(100, 100),
    videos: { kind: "total", total: quota(12, 50) },
  };
}

function card(html, label) {
  const start = html.indexOf(`>${label}</h3>`);
  assert.notEqual(start, -1, `Missing ${label}`);
  const next = html.indexOf("<h3", start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

test("usage indicators apply the exact 80% and 95% thresholds without implying enforcement", () => {
  const html = renderToStaticMarkup(React.createElement(Usage, { report: report(), planName: "Legacy Plus", themes: ["Classic NSG", "Ocean Breeze"] }));
  assert.match(html, /Legacy Plus/);
  assert.match(html, /Classic NSG · Ocean Breeze/);
  assert.match(html, /No plan limits are enforced during beta/);
  assert.doesNotMatch(card(html, "Photos"), /Approaching|Near plan|At or above/);
  assert.match(card(html, "Stories"), /Approaching plan allowance/);
  assert.match(card(html, "Audio Moments"), /Approaching plan allowance/);
  assert.match(card(html, "Future Moment Makers™"), /Near plan allowance/);
  const cannotOpenUntil = card(html, "Cannot Open Until™ Moments");
  assert.match(cannotOpenUntil, /100.*\/.*100/);
  assert.match(cannotOpenUntil, /At or above plan allowance/);
  assert.doesNotMatch(cannotOpenUntil, /Scheduled opening is coming soon/);
  assert.match(card(html, "Videos"), /12.*\/.*50/);
  assert.doesNotMatch(html, /Grandfathered Beta Access/);
});

test("grandfathered accounts retain unlimited beta access and do not receive quota warnings", () => {
  const html = renderToStaticMarkup(React.createElement(Usage, { report: report("grandfathered"), planName: "Free Legacy", themes: ["Classic NSG"] }));
  assert.match(html, /Grandfathered Beta Access/);
  assert.match(html, /beta access has no plan-based limits/);
  assert.match(card(html, "Stories"), /No plan-based limit.*Plan reference: 100/);
  assert.doesNotMatch(html, /Approaching plan allowance|Near plan allowance|At or above plan allowance|role="progressbar"/);
});

test("free video buckets and unresolved or unlimited allowances are shown accurately", () => {
  const data = report("unreviewed");
  data.photos = quota(7, "unreviewed");
  data.futureMomentMakers = quota(4, null);
  data.videos = { kind: "audience", public: quota(1, 3), nonPublic: quota(2, 2) };
  data.videos.nonPublic.effectiveLimit = "unreviewed";
  const html = renderToStaticMarkup(React.createElement(Usage, { report: data, planName: "Legacy membership", themes: ["Classic NSG"] }));
  assert.match(card(html, "Photos"), /Plan allowance unavailable/);
  assert.match(card(html, "Public Videos"), /1.*\/.*3/);
  assert.match(card(html, "Non-public Videos"), /2.*\/.*2/);
  assert.match(card(html, "Future Moment Makers™"), /No plan-based limit/);
  assert.doesNotMatch(card(html, "Non-public Videos"), /At or above plan allowance/);
  assert.doesNotMatch(html, /Grandfathered Beta Access|unreviewed/);
});

test("membership page requires authentication and loads only the signed-in account", async () => {
  let user = { id: "owner" };
  const calls = [];
  const data = report();
  const page = loadModule("app/my-profile/membership/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "@/lib/auth": { requireUser: async () => {
      if (!user) throw new Error("Sign in required");
      return user;
    } },
    "@/lib/entitlements": {
      getEntitlements: async (id) => { calls.push(["entitlements", id]); return { plan: "legacy-plus", currentThemes: ["classic"] }; },
      getUsageCounts: async (id) => { calls.push(["usage", id]); return {}; },
      createUsageReport: () => data,
    },
    "@/lib/membership-plans": { membershipPlans: [{ id: "legacy-plus", name: "Legacy Plus" }] },
    "@/lib/site-themes": { siteThemes: [{ id: "classic", name: "Classic NSG" }] },
    "./usage-summary": { default: Usage },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Legacy Plus/);
  assert.match(html, /href="\/my-profile\/membership\/content"[^>]*>Manage Content/);
  assert.deepEqual(calls, [["entitlements", "owner"], ["usage", "owner"]]);
  user = null;
  await assert.rejects(page(), /Sign in required/);
  assert.equal(calls.length, 2);
});
