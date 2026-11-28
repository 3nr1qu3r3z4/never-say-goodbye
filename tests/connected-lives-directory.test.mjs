import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Date,
    require: (name) => {
      if (name === "@/app/family-feed" && !(name in dependencies)) return {
        default: () => React.createElement("button", null, "Family Feed™"),
        FamilyFeedLink: ({ treeId, bulletinId, className }) => React.createElement("a", {
          href: `/family-calendar?tree=${encodeURIComponent(treeId)}#bulletin-${encodeURIComponent(bulletinId)}`, className,
        }, "View Shout-Out"),
      };
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const relationships = loadModule("lib/connected-lives.ts");
const directory = loadModule("lib/connected-lives-directory.ts", {
  "@/lib/connected-lives": relationships,
});
const reflection = loadModule("lib/legacy-reflection.ts", {
  "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts"),
});

test("directional relationships are reciprocal and legacy relationships are unchanged", () => {
  assert.equal(relationships.relationshipForViewer("parent", "bob", "alice"), "parent");
  assert.equal(relationships.relationshipForViewer("parent", "bob", "bob"), "child");
  assert.equal(relationships.relationshipForViewer("child", "alice", "alice"), "parent");
  assert.equal(relationships.relationshipForViewer("family", null, "alice"), "family");
});

test("directory searches and combines relationship and tag filters; sorts unknown dates last", () => {
  const people = [
    { id: "1", displayName: "Zoe", relationshipType: "parent", personTags: [{ label: "Veteran" }], acceptedAt: "2025-01-01T00:00:00Z" },
    { id: "2", displayName: "Amy", relationshipType: "close_friend", personTags: [{ label: "Teacher" }], acceptedAt: null },
    { id: "3", displayName: "Bob", relationshipType: "spouse_partner", personTags: [{ label: "Veteran" }], acceptedAt: "2026-01-01T00:00:00Z" },
    { id: "4", displayName: "Cara", relationshipType: "future_category", personTags: [{ label: "All" }], acceptedAt: "2024-01-01T00:00:00Z" },
  ];
  const ids = (search, relationship, tag, sort) =>
    Array.from(directory.filterConnections(people, search, relationship, tag, sort), (item) => item.id);
  assert.deepEqual(ids("veter", "family-group", "tag:veteran", "az"), ["3", "1"]);
  assert.deepEqual(ids("", "type:close_friend", "all", "az"), ["2"]);
  assert.deepEqual(ids("", "type:future_category", "all", "az"), ["4"]);
  assert.deepEqual(ids("", "all", "tag:all", "az"), ["4"]);
  assert.deepEqual(ids("", "all", "all", "recent"), ["3", "1", "4", "2"]);
  assert.deepEqual(ids("", "all", "all", "oldest"), ["4", "1", "3", "2"]);
  assert.deepEqual(ids("", "all", "all", "za"), ["1", "4", "3", "2"]);
});

test("directory toggles between grid and compact list without losing filters or profile privacy", () => {
  const states = [];
  let stateIndex = 0;
  let controls = [];
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useMemo: (calculate) => calculate(),
  };
  const capture = (factory) => (type, props, key) => {
    if (type === "button" || type === "input" || type === "select") controls.push({ elementType: type, ...props });
    return factory(type, props, key);
  };
  const component = loadModule("app/connected-lives/directory.tsx", {
    "react/jsx-runtime": { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) },
    react,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "@/lib/connected-lives": relationships,
    "@/lib/connected-lives-directory": directory,
    "./relationship-editor": { default: () => React.createElement("span", null, "Edit relationship") },
    "./shared-tags": { default: () => React.createElement("span", null, "Manage Shared Tags") },
  }).default;
  const connections = [
    { id: "z", personId: "person/z", displayName: "Zoe", relationshipType: "parent",
      acceptedAt: "2025-01-02T00:00:00Z", profilePhoto: "data:image/png;base64,abc",
      profileVisible: true, birthYear: null, personTags: [{ id: "tag", label: "Veteran" }], ownTags: [] },
    { id: "a", personId: "hidden", displayName: "Amy", relationshipType: "close_friend",
      acceptedAt: null, profilePhoto: null, profileVisible: false, birthYear: null, personTags: [], ownTags: [] },
  ];
  const render = () => {
    stateIndex = 0;
    controls = [];
    return renderToStaticMarkup(React.createElement(component, { connections, viewerId: "viewer" }));
  };
  const toggle = (name) => controls.find((control) => control.elementType === "button" && control.children === name);
  let html = render();
  assert.equal(toggle("Grid")["aria-pressed"], true);
  assert.equal(toggle("List")["aria-pressed"], false);
  assert.match(html, /Edit relationship/);
  assert.match(html, /Manage Shared Tags/);
  assert.ok(html.indexOf("Amy") < html.indexOf("Zoe"));
  toggle("List").onClick();
  html = render();
  assert.equal(toggle("Grid")["aria-pressed"], false);
  assert.equal(toggle("List")["aria-pressed"], true);
  assert.match(html, /src="data:image\/png;base64,abc"/);
  assert.match(html, /Veteran/);
  assert.match(html, /Connected January 2, 2025/);
  assert.match(html, /Connected Date Unavailable/);
  assert.match(html, /href="\/moment-maker\/person%2Fz"/);
  assert.doesNotMatch(html, /href="\/moment-maker\/hidden"/);
  assert.doesNotMatch(html, /Edit relationship|Manage Shared Tags/);
  controls.find((control) => control.elementType === "input" && control.type === "checkbox")
    .onChange({ target: { checked: true } });
  html = render();
  assert.match(html, /All Connections/);
  assert.match(html, /Sorting applies within each relationship group/);
  assert.match(html, /Parent/);
  assert.match(html, /Friend/);
  controls.find((control) => control.elementType === "input" && control.placeholder === "Name or tag")
    .onChange({ target: { value: "Veteran" } });
  html = render();
  assert.match(html, /Zoe/);
  assert.doesNotMatch(html, /Amy/);
  toggle("Grid").onClick();
  html = render();
  assert.match(html, /Zoe/);
  assert.doesNotMatch(html, /Amy/);
  assert.match(html, /Edit relationship/);
});

function loadDashboard(data, founder = false, familyActivity = [], bulletins = [], preview = {}) {
  const page = loadModule("app/dashboard/page.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "@/lib/auth": { requireUser: async () => {
      if (preview.unauthenticated) throw new Error("Not authenticated");
      return { id: "owner", firstName: "Owner" };
    } },
    "@/lib/admin": { isFounder: () => founder },
    "@/lib/account-data": { getDashboardData: async () => ({
      ...data, reflection: reflection.legacyReflection(data.counts, null, 0),
    }) },
    "@/lib/moment-access": { getRecentOwnMoments: async (id) => {
      assert.equal(id, "owner");
      return preview.ownMoments ?? [];
    }, getRecentFamilyActivity: async (id) => {
      assert.equal(id, "owner");
      return familyActivity;
    } },
    "@/lib/family-calendar-data": {
      getFamilyBulletins: async () => bulletins,
      getCalendarSettings: async (id) => { assert.equal(id, "owner"); return { trees: preview.trees ?? [] }; },
      getCalendarEvents: async (id, tree) => { assert.equal(id, "owner"); assert.equal(tree, preview.trees[0].id); return preview.events ?? []; },
    },
    "@/lib/family-calendar": loadModule("lib/family-calendar.ts"),
    "@/lib/tree-milestones-data": { getTreeMilestones: async (id, tree) => {
      assert.equal(id, "owner"); assert.equal(tree, preview.trees[0].id); return preview.milestones ?? [];
    } },
    "@/lib/my-legacy-data": {
      getLegacyProfile: async (id) => { assert.equal(id, "owner"); return preview.profile ?? { displayName: "Owner", bio: "", profilePhoto: null, discoverability: "private" }; },
      getLegacyConnections: async (id) => { assert.equal(id, "owner"); return preview.connections ?? []; },
    },
    "@/lib/successor": {
      canManageSuccessor: async () => Boolean(preview.successorEnabled),
      getOwnSuccessor: async () => preview.successor ?? null,
      hasTransferredSuccessor: async () => false,
    },
    "@/app/moments/moment-card": { default: ({ moment }) => React.createElement("li", null, moment.title) },
    "@/lib/frequent-visits": { frequentVisitsEnabled: () => false },
    "./signup-welcome": { default: () => null },
    "./frequent-visits": { default: () => null },
  }).default;
  return () => page({ searchParams: Promise.resolve({}) });
}

test("legacy reflections rotate through real counts and handle incomplete trees", () => {
  const person = (kind, id, relationship, isOwner = false, reference = null) => ({
    kind, data: { id, linePartnerType: reference?.type ?? null, linePartnerId: reference?.id ?? null },
    name: id, relationship, isOwner,
  });
  const tree = reflection.summarizeReflectionTree([
    person("member", "owner", null, true),
    person("placeholder", "child", "Daughter"),
    person("future", "grandchild", "Son", false, { type: "placeholder", id: "child" }),
  ]);
  assert.equal(tree.people, 3);
  assert.equal(tree.generations, 3);
  const counts = { sharedMoments: 1, personalMoments: 2, connectedLives: 1 };
  assert.equal(reflection.legacyReflection(counts, tree, 0), "Your Legacy Tree™ includes 3 people across 3 generations.");
  assert.equal(reflection.legacyReflection(counts, tree, 1), "You have preserved 1 shared memory.");
  assert.equal(reflection.legacyReflection(counts, tree, 2), "You have preserved 2 personal moments.");
  assert.equal(reflection.legacyReflection(counts, tree, 3), "You are connected with 1 person through Connected Lives™.");
  assert.equal(reflection.legacyReflection(counts, tree, 4), reflection.legacyReflection(counts, tree, 0));
  const incomplete = reflection.summarizeReflectionTree([
    person("member", "owner", null, true), person("placeholder", "cousin", "Cousin"),
  ]);
  assert.equal(reflection.legacyReflection(counts, incomplete, 0), "Your Legacy Tree™ includes 2 people.");
  assert.equal(
    reflection.legacyReflection({ sharedMoments: 0, personalMoments: 0, connectedLives: 0 }, null, 0),
    "Every memory and connection helps tell your family's story.",
  );
});

test("dashboard places one reflection immediately beneath the welcome", async () => {
  const data = { counts: { sharedMoments: 1, personalMoments: 0, connectedLives: 0, newLivesRequests: 0,
    unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0 }, recentActivity: [] };
  const html = renderToStaticMarkup(await loadDashboard(data)());
  assert.match(html, /Welcome back, Owner\.[\s\S]*?Keep building the moments that matter most\.[\s\S]*?Legacy Reflection<\/h2>[\s\S]*?You have preserved 1 shared memory\./);
  assert.equal((html.match(/Legacy Reflection/g) ?? []).length, 1);
});

test("successor controls appear only for eligible owners", async () => {
  const data = { counts: { sharedMoments: 0, personalMoments: 0, connectedLives: 0, newLivesRequests: 0,
    unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0 }, recentActivity: [] };
  const disabled = renderToStaticMarkup(await loadDashboard(data)());
  assert.doesNotMatch(disabled, /Legacy Successor™/);
  assert.doesNotMatch(disabled, /href="\/my-profile\/successor"/);
  const disabledActions = disabled.match(/<section aria-labelledby="legacy-quick-actions-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(disabledActions);
  assert.doesNotMatch(disabledActions, /Successor Assignment/);
  const available = renderToStaticMarkup(await loadDashboard(data, false, [], [], {
    successorEnabled: true, successor: { name: "Alex", valid: true },
  })());
  assert.doesNotMatch(available, /Limited Preview|approved preview accounts/);
  assert.match(available, /Legacy Successor™[\s\S]*?Alex[\s\S]*?href="\/my-profile\/successor"[^>]*>Manage Successor/);
  const enabledActions = available.match(/<section aria-labelledby="legacy-quick-actions-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(enabledActions);
  assert.doesNotMatch(enabledActions, /Successor Assignment|href="\/my-profile\/successor"/);
  assert.match(enabledActions, /href="\/my-profile\/membership"/);
  const unassigned = renderToStaticMarkup(await loadDashboard(data, false, [], [], { successorEnabled: true })());
  assert.match(unassigned, /Legacy Successor™[\s\S]*?Not Assigned[\s\S]*?href="\/my-profile\/successor"[^>]*>Assign Successor/);
  const unavailable = renderToStaticMarkup(await loadDashboard(data, false, [], [], {
    successorEnabled: true, successor: { name: "Alex", valid: false },
  })());
  assert.match(unavailable, /Choose another successor/);
});

test("My Legacy brings owner details and existing destinations together with empty previews", async () => {
  const data = { counts: { sharedMoments: 0, personalMoments: 0, connectedLives: 0, newLivesRequests: 0,
    unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0 }, recentActivity: [] };
  const html = renderToStaticMarkup(await loadDashboard(data, false, [], [], {
    profile: { displayName: "Jane Owner", bio: "A private owner bio", profilePhoto: "data:image/png;base64,abc", discoverability: "private" },
  })());
  assert.match(html, /src="data:image\/png;base64,abc"/);
  assert.match(html, /Jane Owner/);
  assert.match(html, /A private owner bio/);
  assert.match(html, /Profile visibility: Hidden/);
  for (const href of ["/my-profile", "/my-profile/preview", "/create-moment", "/legacy-tree", "/connected-lives", "/family-calendar", "/legacy-controls", "/my-profile#appearance", "/email-preferences"]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.match(html, /You haven&#x27;t published a Shared Moment yet/);
  assert.match(html, /Your accepted connections will appear here/);
  assert.match(html, /Create or join a Legacy Tree™ to see its family calendar/);
  assert.match(html, /Your family trees will appear here/);
  await assert.rejects(loadDashboard(data, false, [], [], { unauthenticated: true })(), /Not authenticated/);
});

test("My Legacy previews own moments, connections and the first accessible tree's upcoming dates", async () => {
  const data = { counts: { sharedMoments: 1, personalMoments: 0, connectedLives: 1, newLivesRequests: 0,
    unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0 }, recentActivity: [] };
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const html = renderToStaticMarkup(await loadDashboard(data, false, [], [], {
    profile: { displayName: "Owner", bio: "", profilePhoto: null, discoverability: "searchable" },
    ownMoments: [{ id: "own", title: "My memory" }],
    connections: [{ id: "connection", displayName: "Family member" }],
    trees: [{ id: "tree/one", name: "First tree" }, { id: "tree-two", name: "Second tree" }],
    events: [{ id: "event", title: "Family gathering", date, repeatsYearly: false, source: "Manual Event" },
      { id: "past", title: "Past event", date: "2000-01-01", repeatsYearly: false, source: "Manual Event" }],
    milestones: [{ id: "milestone", kind: "birthday", personName: "Jane", title: "Birthday", year: null,
      month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)), repeatsYearly: true }],
  })());
  assert.match(html, /Profile visibility: Searchable Only/);
  assert.match(html, /Your Moments[\s\S]*My memory/);
  assert.match(html, /Connected Lives™[\s\S]*Family member/);
  assert.match(html, /First tree · Next 90 days[\s\S]*Family gathering[\s\S]*Jane Birthday|First tree · Next 90 days[\s\S]*Jane Birthday[\s\S]*Family gathering/);
  assert.doesNotMatch(html, /Past event/);
  assert.match(html, /href="\/family-calendar\?tree=tree%2Fone&amp;view=agenda"/);
  assert.match(html, /href="\/legacy-tree#legacy-tree-item-tree%2Fone"/);
  assert.match(html, /Second tree/);
});

test("family bulletins share the recent activity limit and link to their calendar", async () => {
  const data = { counts: { sharedMoments: 0, personalMoments: 0, connectedLives: 0, newLivesRequests: 0,
    unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0 }, recentActivity: [] };
  const moments = Array.from({ length: 5 }, (_, i) => ({
    id: `m${i}`, authorName: "Alex", createdAt: `2026-01-0${i + 1}T00:00:00Z`, relativeTime: "Recently",
    hasVideo: false, hasPhoto: false, hasMessage: true,
  }));
  const bulletins = [{ id: "bulletin", treeId: "family", authorName: "Enrique", createdAt: "2026-01-06T00:00:00Z", message: "Hello" }];
  const html = renderToStaticMarkup(await loadDashboard(data, false, moments, bulletins)());
  assert.match(html, /Family Feed™/);
  const feed = html.match(/<section aria-labelledby="moments-in-the-making-heading"[\s\S]*?<\/section>/)?.[0];
  assert.match(feed, /New family shout-out from/);
  assert.match(feed, /href="\/family-calendar\?tree=family#bulletin-bulletin"[^>]*>View Shout-Out/);
  assert.equal((feed.match(/<li /g) ?? []).length, 5);
  assert.doesNotMatch(feed, /href="\/moments\/m0"/);
});

test("Moments in the Making shows shared media, relative time and moment links", async () => {
  const data = {
    counts: {
      sharedMoments: 0, personalMoments: 0, connectedLives: 0, newLivesRequests: 0,
      unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0,
    },
    recentActivity: [{ id: "own", action: "Created", detail: "Existing activity" }],
  };
  const entries = [
    { id: "video/id", authorName: "Kiowea", createdAt: "2026-01-01", relativeTime: "5 minutes ago", hasVideo: true, hasPhoto: true, hasMessage: true },
    { id: "photo", authorName: "Alex", createdAt: "invalid", relativeTime: "Date unavailable", hasVideo: false, hasPhoto: true, hasMessage: false },
    { id: "message", authorName: "Sam", createdAt: "2026-01-01", relativeTime: "Just now", hasVideo: false, hasPhoto: false, hasMessage: true },
    { id: "moment", authorName: "Lee", createdAt: "2026-01-01", relativeTime: "Just now", hasVideo: false, hasPhoto: false, hasMessage: false },
  ];
  const html = renderToStaticMarkup(await loadDashboard(data, false, entries)());
  const feed = html.match(/<section aria-labelledby="moments-in-the-making-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(feed);
  assert.match(feed, /🎥[\s\S]*New video, photo and message shared by <span[^>]*>Kiowea<\/span>/);
  assert.match(feed, /5 minutes ago/);
  assert.match(feed, /href="\/moments\/video%2Fid"[^>]*aria-label="View Kiowea&#x27;s moment"[^>]*>View Moment<\/a>/);
  assert.match(feed, /📷[\s\S]*New photo shared by <span[^>]*>Alex<\/span>/);
  assert.match(feed, /Date unavailable/);
  assert.match(feed, /💬[\s\S]*New message shared by <span[^>]*>Sam<\/span>/);
  assert.match(feed, /New memory shared by <span[^>]*>Lee<\/span>/);
  assert.equal((feed.match(/>View Moment<\/a>/g) ?? []).length, 4);
  assert.doesNotMatch(html, /Recent Family Activity/);
  assert.match(html, /Existing activity/);
  const empty = renderToStaticMarkup(await loadDashboard(data)());
  assert.match(empty, /No new moments yet\./);
  assert.match(empty, /Create a memory, share a photo, or upload a video to start building your family&#x27;s story\./);
});

test("admin dashboard link is visible only to the founder", async () => {
  const data = {
    counts: {
      sharedMoments: 0, personalMoments: 0, connectedLives: 0,
      newLivesRequests: 0, unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0,
    },
    futureMomentMakers: [], recentActivity: [],
  };
  assert.doesNotMatch(renderToStaticMarkup(await loadDashboard(data)()), /href="\/admin-dashboard"/);
  assert.match(renderToStaticMarkup(await loadDashboard(data, true)()), /href="\/admin-dashboard"/);
});

test("My Legacy keeps requested quick actions and retains request and update links", async () => {
  const data = {
    counts: {
      sharedMoments: 0, personalMoments: 0, connectedLives: 0,
      newLivesRequests: 0, unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 0,
    },
    futureMomentMakers: [],
    recentActivity: [],
  };
  const dashboard = loadDashboard(data);
  for (const [requests, updates, expected] of [
    [0, 0, null],
    [1, 2, "1 New Request"],
    [2, 0, "2 New Requests"],
    [0, 1, "1 New Update"],
    [0, 2, "2 New Updates"],
  ]) {
    data.counts.newLivesRequests = requests;
    data.counts.unreadLivesNotifications = updates;
    const html = renderToStaticMarkup(await dashboard());
    const card = html.match(/<section aria-labelledby="moments-in-the-making-heading"[\s\S]*?<\/section>/)?.[0];
    assert.ok(card);
    assert.equal((card.match(/❤️/g) ?? []).length, 1);
    assert.match(card, /<h2 id="moments-in-the-making-heading"[^>]*>Moments in the Making<\/h2>/);
    assert.doesNotMatch(card, /See the latest memories, photos, videos, and messages/);
    assert.doesNotMatch(html, /href="\/search"|legacy-search|Search moments, people, messages|settings-shortcuts-heading/);
    const actions = html.match(/<section aria-labelledby="legacy-quick-actions-heading"[\s\S]*?<\/section>/)?.[0];
    assert.ok(actions);
    for (const [label, href] of [
      ["Create Moment", "/create-moment"],
      ["Open Legacy Tree™", "/legacy-tree"],
      ["Legacy Controls™", "/legacy-controls"],
      ["Appearance", "/my-profile#appearance"],
      ["Email Preferences", "/email-preferences"],
      ["Membership &amp; Usage", "/my-profile/membership"],
    ]) {
      assert.match(actions, new RegExp(`<a href="${href}"[^>]*>${label}</a>`));
    }
    assert.doesNotMatch(actions, /View your membership details, content usage, themes, and content management tools/);
    assert.equal((actions.match(/<a /g) ?? []).length, 6);
    assert.match(html, /My Legacy Snapshot[\s\S]*?Moment Making Menu/);
    assert.doesNotMatch(card, /View Connected Lives|Stay Connected|Someone Is Thinking of You/);
    if (expected) {
      assert.match(card, new RegExp(`<a href="/connected-lives"[^>]*>${expected}</a>`));
    } else {
      assert.doesNotMatch(card, /href="\/connected-lives"/);
    }
  }
});

test("dashboard groups moment, people, and profile destinations without losing draft count", async () => {
  const dashboard = loadDashboard({
    counts: {
      sharedMoments: 0, personalMoments: 0, connectedLives: 0,
      newLivesRequests: 0, unreadLivesNotifications: 0, futureMomentMakers: 0, drafts: 3,
    },
    futureMomentMakers: [],
    recentActivity: [],
  });
  const html = renderToStaticMarkup(await dashboard());
  const section = html.match(/<section id="moment-making-menu"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  const groups = [...section.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)].map(([group]) => group);
  assert.equal(groups.length, 3);
  assert.match(groups[0], /<summary\b[^>]*>[\s\S]*?Create Moment[\s\S]*?<\/summary>/);
  assert.match(groups[0], /href="\/create-moment"[^>]*>New Moment<\/a>/);
  assert.match(groups[0], /href="\/drafts"[^>]*>Drafts \(3\)<\/a>/);
  assert.match(groups[0], /href="\/moments"[^>]*>Shared Moments<\/a>/);
  assert.match(groups[0], /href="\/create-moment\/shared"[^>]*>Shared Moment<\/a>/);
  assert.match(groups[0], /href="\/create-moment\/personal"[^>]*>Personal \/ Protected Moment<\/a>/);
  assert.match(groups[0], /href="\/create-moment\/cannot-open-until"[^>]*>Cannot Open Until™ \(scheduled opening\)<\/a>/);
  assert.doesNotMatch(groups[0], /future-moment-maker|connected-lives#future-heading|legacy-tree/);
  assert.match(groups[1], /<summary\b[^>]*>[\s\S]*?Connected Lives™[\s\S]*?<\/summary>/);
  assert.match(groups[1], /href="\/connected-lives"[^>]*>Connected Lives Directory<\/a>/);
  assert.match(groups[1], /href="\/create-moment\/future-moment-maker"[^>]*>Create Future Moment Maker™<\/a>/);
  assert.match(groups[1], /href="\/connected-lives#future-heading"[^>]*>View Future Moment Makers™<\/a>/);
  assert.match(groups[1], /href="\/legacy-tree"[^>]*>Family Placeholders \(Legacy Tree™\)<\/a>/);
  assert.match(groups[1], /href="\/honored-lives"[^>]*>Honored Lives™<\/a>/);
  assert.match(groups[1], /href="\/email-preferences"[^>]*>Email Preferences<\/a>/);
  assert.match(groups[2], /<summary\b[^>]*>[\s\S]*?My Profile[\s\S]*?<\/summary>/);
  assert.match(groups[2], /href="\/my-profile"[^>]*>View Profile<\/a>/);
  assert.match(groups[2], /href="\/legacy-controls"[^>]*>Legacy Controls™<\/a>/);
  assert.doesNotMatch(section, /href="\/help"/);
  for (const href of ["/create-moment", "/drafts", "/create-moment/shared", "/create-moment/personal", "/create-moment/cannot-open-until", "/create-moment/future-moment-maker", "/my-profile", "/legacy-controls", "/connected-lives", "/family-calendar"]) {
    assert.equal([...section.matchAll(new RegExp(`href="${href}"`, "g"))].length, 1, href);
  }
  assert.equal((section.match(/href="\/legacy-tree"/g) ?? []).length, 2);
});

test("dashboard omits the future-maker section while retaining its count and menu links", async () => {
  const data = {
    counts: {
      sharedMoments: 0, personalMoments: 0, connectedLives: 0,
      newLivesRequests: 0, unreadLivesNotifications: 0, futureMomentMakers: 2, drafts: 0,
    },
    futureMomentMakers: [
      { id: "first", name: "First Person", relationship: "Grandchild", momentCount: 1 },
      { id: "second/record", name: "Second Person", relationship: "Godchild", momentCount: 0 },
    ],
    recentActivity: [],
  };
  const dashboard = loadDashboard(data);
  for (const futureMakers of [data.futureMomentMakers, []]) {
    data.futureMomentMakers = futureMakers;
    data.counts.futureMomentMakers = futureMakers.length;
    const html = renderToStaticMarkup(await dashboard());
    assert.doesNotMatch(html, /future-makers-heading|A place for a story still to come/);
    assert.match(html, new RegExp(`<dt[^>]*>[\\s\\S]*?Future Moment Makers™</a></dt><dd[^>]*>${futureMakers.length}</dd>`));
    assert.match(html, /href="\/create-moment\/future-moment-maker"[^>]*>Create Future Moment Maker™<\/a>/);
    assert.match(html, /href="\/connected-lives#future-heading"[^>]*>View Future Moment Makers™<\/a>/);
  }
});

test("dashboard snapshot shares the card row and links available metrics", async () => {
  const dashboard = loadDashboard({
    counts: {
      sharedMoments: 3, personalMoments: 2, connectedLives: 4,
      futureMomentMakers: 5, drafts: 6, newLivesRequests: 0, unreadLivesNotifications: 0,
    },
    futureMomentMakers: [], recentActivity: [],
  });
  const html = renderToStaticMarkup(await dashboard());
  const snapshot = html.match(/<section aria-labelledby="summary-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(snapshot);
  const cards = html.match(/<div class="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">[\s\S]*?<\/section><\/div>/)?.[0];
  assert.ok(cards);
  for (const heading of ["connections-preview-heading", "calendar-preview-heading", "tree-preview-heading", "summary-heading"]) {
    assert.match(cards, new RegExp(`aria-labelledby="${heading}"`));
  }
  for (const [label, count, href] of [
    ["Shared Moments", 3, "/moments"],
    ["Connected Lives", 4, "/connected-lives"],
    ["Future Moment Makers™", 5, "/connected-lives#future-heading"],
    ["Drafts", 6, "/drafts"],
  ]) {
    assert.match(snapshot, new RegExp(`<dt[^>]*><a href="${href}" aria-label="View ${label}, ${count}"[^>]*>${label}</a></dt><dd[^>]*>${count}</dd>`));
  }
  assert.match(snapshot, /<dt[^>]*>Personal Moments<\/dt><dd[^>]*>2<\/dd>/);
  assert.equal((snapshot.match(/<dt/g) ?? []).length, 5);
  assert.equal((snapshot.match(/<a /g) ?? []).length, 4);
  assert.doesNotMatch(snapshot, /<button|Your story, at a glance/);
});

test("pending incoming requests are highlighted above the directory with visible actions", async () => {
  const response = loadModule("app/connected-lives/connection-response.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/app/actions/connected-lives": { respondToConnectedLivesRequest: async () => ({}) },
    "./relationship-options": { default: () => null },
  }).default;
  const rows = [
    { id: "in-1", status: "pending", requesterId: "alice", recipientId: "owner", displayName: "Alice" },
    { id: "in-2", status: "pending", requesterId: "bob", recipientId: "owner", displayName: "Bob" },
    { id: "sent", status: "pending", requesterId: "owner", recipientId: "other", displayName: "Other" },
    { id: "accepted", status: "accepted", requesterId: "owner", recipientId: "friend", displayName: "Friend" },
  ];
  const page = loadModule("app/connected-lives/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/db": { getSql: () => async (strings) => {
      const query = strings.join("?");
      if (query.includes("FROM connected_lives AS cl")) return rows;
      if (query.includes("FROM notifications")) return [{ id: "notification", message: "New update", type: "request", readAt: null }];
      return [];
    } },
    "@/lib/connected-lives": relationships,
    "@/app/actions/connected-lives": { markLivesNotificationsRead: () => {} },
    "./connection-response": { default: response },
    "./directory": { default: ({ connections }) => React.createElement("section", { id: "directory" }, `Directory: ${connections.length} existing connections`) },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Family Feed™/);
  const section = html.match(/<section[^>]*aria-labelledby="requests-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /border-\[color:var\(--nsg-accent\)\]\/50/);
  assert.match(section, /Pending Connection Requests<span[^>]*>2<\/span>/);
  assert.match(section, /Alice[\s\S]*?name="requestId" value="in-1"[\s\S]*?>Accept<\/button>[\s\S]*?>Decline<\/button>/);
  assert.match(section, /Bob[\s\S]*?name="requestId" value="in-2"[\s\S]*?>Accept<\/button>[\s\S]*?>Decline<\/button>/);
  assert.doesNotMatch(section, /Other|Friend/);
  assert.ok(html.indexOf("</h1>") < html.indexOf(section));
  assert.ok(html.indexOf(section) < html.indexOf('id="directory"'));
  assert.ok(html.indexOf('id="directory"') < html.indexOf('id="future-heading"'));
  assert.ok(html.indexOf('id="directory"') < html.indexOf("Mark Notifications Read"));

  rows.splice(0, 2);
  const withoutIncoming = renderToStaticMarkup(await page());
  assert.doesNotMatch(withoutIncoming, /requests-heading|Pending Connection Requests|You do not have any requests to review/);
  assert.match(withoutIncoming, /Directory: 1 existing connections/);
  assert.match(withoutIncoming, /Requests Sent/);
});

test("connected lives lists owned future-maker records with distinct routes", async () => {
  const futureMakers = [
    { id: "first", name: "First Person", relationship: "Grandchild", status: "awaiting-claim" },
    { id: "second/record", name: "Second Person", relationship: "Godchild", status: "claimed" },
  ];
  const sql = async (strings, ...values) => {
    const query = strings.join("?");
    if (query.includes("FROM future_moment_makers")) {
      assert.match(query, /owner_user_id = \? AND status <> 'archived'/);
      assert.equal(values[0], "owner");
      return futureMakers;
    }
    return [];
  };
  const page = loadModule("app/connected-lives/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/db": { getSql: () => sql },
    "@/lib/connected-lives": relationships,
    "@/app/actions/connected-lives": { markLivesNotificationsRead: () => {} },
    "./connection-response": { default: () => null },
    "./directory": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(await page());
  const section = html.match(/<section[^>]*aria-labelledby="future-heading"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /First Person[\s\S]*?href="\/future-moment-maker\/first"/);
  assert.match(section, /Second Person[\s\S]*?href="\/future-moment-maker\/second%2Frecord"/);
  assert.doesNotMatch(section, /href="\/future-moment-maker"/);
});

test("migration, shared tags, privacy and future-record authorization in disposable PostgreSQL", {
  skip: process.env.CONNECTED_LIVES_TEST_PGLITE ? false : "Set CONNECTED_LIVES_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.CONNECTED_LIVES_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations")).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations.filter((file) => !file.startsWith("015_"))) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    const now = "2026-01-01T00:00:00.000Z";
    for (const id of ["alice", "bob", "outsider"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', $3, $3)`, [id, `${id}@example.test`, now]);
    }
    await db.exec(`
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, relationship_type, status, created_at, updated_at)
        VALUES ('legacy', 'alice', 'outsider', 'outsider', 'Connected Life', 'family', 'accepted', '${now}', '${now}'),
               ('pending', 'alice', 'bob', 'bob', 'Connected Life', NULL, 'pending', '${now}', '${now}');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at) VALUES ('tree', 'alice', 'Family', '${now}', '${now}');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'alice', 'owner', '${now}');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, status, created_at, updated_at)
        VALUES ('future', 'alice', 'tree', 'Future Person', 'Grandchild', 'awaiting-claim', '${now}', '${now}');
    `);
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "015_connected_lives_directory.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const schemaQuery = `SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
        AND (table_name = 'connected_lives_person_tags'
          OR (table_name = 'connected_lives' AND column_name IN ('accepted_at', 'relationship_subject_user_id')))
      ORDER BY table_name, column_name`;
    assert.deepEqual((await db.query(schemaQuery)).rows, (await bootstrap.query(schemaQuery)).rows);
    const legacy = (await db.query("SELECT relationship_type, accepted_at, relationship_subject_user_id FROM connected_lives WHERE id = 'legacy'")).rows[0];
    assert.equal(legacy.relationship_type, "family");
    assert.equal(legacy.accepted_at, null);
    assert.equal(legacy.relationship_subject_user_id, null);

    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    sql.transaction = (queries) => Promise.all(queries);
    const dashboardData = loadModule("lib/account-data.ts", {
      "server-only": {},
      "@/lib/db": { getSql: () => sql },
      "@/lib/legacy-reflection": reflection,
    });
    const legacyData = loadModule("lib/my-legacy-data.ts", {
      "server-only": {},
      "@/lib/db": { getSql: () => sql },
    });
    await db.exec("UPDATE users SET bio = 'Owner-only bio', discoverability = 'private' WHERE id = 'alice'");
    const ownerProfile = await legacyData.getLegacyProfile("alice");
    assert.equal(ownerProfile.bio, "Owner-only bio");
    assert.equal(ownerProfile.discoverability, "private");
    assert.equal((await legacyData.getLegacyProfile("bob")).bio, "");
    await assert.rejects(legacyData.getLegacyProfile("missing"), /profile could not be found/);
    assert.deepEqual(Array.from(await legacyData.getLegacyConnections("alice"), (row) => row.displayName), ["outsider"]);
    assert.deepEqual(Array.from(await legacyData.getLegacyConnections("bob")), []);
    assert.deepEqual(Array.from(await legacyData.getLegacyConnections("outsider"), (row) => row.displayName), ["alice"]);
    await db.exec("UPDATE users SET bio = '', discoverability = 'searchable' WHERE id = 'alice'");
    const aliceDashboard = await dashboardData.getDashboardData({ id: "alice" });
    const day = Math.floor(Date.now() / 86_400_000);
    assert.equal(aliceDashboard.reflection, day % 2 === 0
      ? "Your Legacy Tree™ includes 2 people across 2 generations."
      : "You are connected with 1 person through Connected Lives™.");
    const bobDashboard = await dashboardData.getDashboardData({ id: "bob" });
    assert.equal(bobDashboard.reflection, "Every memory and connection helps tell your family's story.");
    let currentUser = "bob";
    let sequence = 0;
    const deps = {
      "node:crypto": { randomUUID: () => `generated-${++sequence}` },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { requireUser: async () => ({ id: currentUser, displayName: currentUser }) },
      "@/lib/db": { getSql: () => sql },
      "@/lib/connected-lives": relationships,
    };
    const actions = loadModule("app/actions/connected-lives.ts", deps);
    assert.equal((await actions.respondToConnectedLivesRequest({}, form({
      requestId: "pending", response: "accept", relationshipType: "parent",
    }))).status, "connected");
    const accepted = (await db.query("SELECT relationship_type, accepted_at, relationship_subject_user_id FROM connected_lives WHERE id = 'pending'")).rows[0];
    assert.equal(accepted.relationship_type, "parent");
    assert.equal(accepted.relationship_subject_user_id, "alice");
    assert.ok(accepted.accepted_at);
    assert.equal(relationships.relationshipForViewer("parent", accepted.relationship_subject_user_id, "bob"), "parent");
    assert.equal(relationships.relationshipForViewer("parent", accepted.relationship_subject_user_id, "alice"), "child");
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "alice", label: " Veteran " }))).message);
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "alice", label: "veteran" }))).error);
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "outsider", label: "Teacher" }))).error);
    const tag = (await db.query("SELECT id FROM connected_lives_person_tags WHERE connection_id = 'pending'")).rows[0];
    currentUser = "outsider";
    assert.ok((await actions.removeConnectedLifeTag({}, form({ tagId: tag.id }))).error);
    currentUser = "alice";
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "bob", label: "Teacher" }))).message);

    let captured;
    const pageDeps = {
      "react/jsx-runtime": jsxRuntime,
      "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
      "@/lib/auth": deps["@/lib/auth"],
      "@/lib/db": deps["@/lib/db"],
      "@/lib/connected-lives": relationships,
      "@/app/actions/connected-lives": { markLivesNotificationsRead: () => {} },
      "./connection-response": { default: () => null },
      "./directory": { default: (props) => { captured = props; return null; } },
    };
    const page = loadModule("app/connected-lives/page.tsx", pageDeps).default;
    await db.exec("UPDATE users SET birth_year = 1980, share_birthday = TRUE, public_profile_photo = FALSE, profile_photo_data = 'hidden' WHERE id = 'bob'");
    renderToStaticMarkup(await page());
    let bob = captured.connections.find((item) => item.id === "pending");
    assert.equal(bob.relationshipType, "child");
    assert.equal(bob.birthYear, null);
    assert.equal(bob.profilePhoto, null);
    assert.equal(bob.personTags[0].label, "Teacher");
    assert.equal(bob.ownTags[0].label, "Veteran");
    currentUser = "bob";
    renderToStaticMarkup(await page());
    const alice = captured.connections.find((item) => item.id === "pending");
    assert.equal(alice.relationshipType, "parent");
    assert.equal(alice.personTags[0].label, "Veteran");
    assert.equal(alice.ownTags[0].label, "Teacher");
    currentUser = "alice";
    await db.exec(`INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'bob', 'member', '${now}')`);
    renderToStaticMarkup(await page());
    bob = captured.connections.find((item) => item.id === "pending");
    assert.equal(bob.birthYear, 1980);
    await db.exec("UPDATE users SET share_birthday = FALSE WHERE id = 'bob'");
    renderToStaticMarkup(await page());
    assert.equal(captured.connections.find((item) => item.id === "pending").birthYear, null);
    await db.exec("UPDATE users SET public_profile_photo = TRUE, discoverability = 'private' WHERE id = 'bob'");
    renderToStaticMarkup(await page());
    bob = captured.connections.find((item) => item.id === "pending");
    assert.equal(bob.profilePhoto, null);
    assert.equal(bob.profileVisible, false);

    const futureDeps = {
      "react/jsx-runtime": jsxRuntime,
      "next/link": pageDeps["next/link"],
      "next/navigation": { notFound: () => { throw new Error("not found"); } },
      "@/lib/auth": deps["@/lib/auth"], "@/lib/db": deps["@/lib/db"],
      "@/lib/moment-card-style": loadModule("lib/moment-card-style.ts", {}),
    };
    const futurePage = loadModule("app/future-moment-maker/[id]/page.tsx", futureDeps).default;
    assert.match(renderToStaticMarkup(await futurePage({ params: Promise.resolve({ id: "future" }) })), /Future Person/);
    currentUser = "outsider";
    await assert.rejects(futurePage({ params: Promise.resolve({ id: "future" }) }), /not found/);
    currentUser = "alice";
    assert.ok((await actions.updateConnectedLivesRelationship({}, form({
      connectionId: "pending", relationshipType: "parent",
    }))).message);
    const updated = (await db.query("SELECT relationship_type, accepted_at, relationship_subject_user_id FROM connected_lives WHERE id = 'pending'")).rows[0];
    assert.equal(updated.relationship_subject_user_id, "bob");
    assert.equal(relationships.relationshipForViewer(updated.relationship_type, updated.relationship_subject_user_id, "alice"), "parent");
    assert.equal(relationships.relationshipForViewer(updated.relationship_type, updated.relationship_subject_user_id, "bob"), "child");
    assert.equal(String(updated.accepted_at), String(accepted.accepted_at));
    assert.ok((await actions.removeConnectedLifeTag({}, form({ tagId: tag.id }))).message);
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'pending'");
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "bob", label: "Veteran" }))).error);
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
