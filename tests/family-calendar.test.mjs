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
    URLSearchParams,
  });
  return exports;
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const calendar = loadModule("lib/family-calendar.ts");
const milestones = loadModule("lib/tree-milestones.ts");

test("dates reject invalid values and yearly occurrences respect leap years and start dates", () => {
  assert.equal(calendar.validCalendarDate("2024-02-29"), true);
  assert.equal(calendar.validCalendarDate("2023-02-29"), false);
  assert.equal(calendar.validCalendarDate("0000-01-01"), false);
  const events = [
    { id: "leap", title: "Leap", date: "2024-02-29", repeatsYearly: true, source: "Tree" },
    { id: "once", title: "Once", date: "2025-03-01", repeatsYearly: false, source: "Manual" },
    { id: "yearless", title: "Birthday", date: "--05-12", repeatsYearly: true, source: "Tree" },
  ];
  assert.deepEqual(Array.from(calendar.occurrences(events.slice(0, 2), "2023-01-01", "2028-12-31"), (event) => event.date),
    ["2024-02-29", "2025-03-01", "2028-02-29"]);
  assert.deepEqual(Array.from(calendar.occurrences(events.slice(2), "2026-01-01", "2027-12-31"), (event) => event.date),
    ["2026-05-12", "2027-05-12"]);
});

test("calendar places exact milestones and separately shows partial or unknown dates", async () => {
  const rows = [
    { id: "birthday", kind: "birthday", personName: "Courtney", title: "Birthday", year: null, month: 5, day: 12, repeatsYearly: true },
    { id: "grad", kind: "graduation", personName: "Courtney", title: "Graduation", year: 2035, month: 6, day: null, repeatsYearly: false },
    { id: "custom", kind: "custom", personName: "Courtney", title: "First Day of College", year: null, month: null, day: null, repeatsYearly: false },
  ];
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => rows },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner" }] }),
      getCalendarEvents: async () => [],
      getFamilyBulletins: async () => [],
    },
    "./calendar-forms": Object.fromEntries(["BulletinForm", "ManualEvent", "ReminderSettings"].map((name) => [name, () => null])),
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "tree", date: "2026-05-12" }) }));
  assert.match(html, /Courtney Birthday/);
  assert.match(html, /Milestones without an exact day[\s\S]*Courtney Graduation · June 2035/);
  assert.match(html, /Courtney First Day of College · Date not set/);
  assert.doesNotMatch(html, /2035-06-01/);
});

test("tree milestone panel shows editable family milestones and consent controls", async () => {
  const formComponents = loadModule("app/legacy-tree/milestone-forms.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: { ...React, useActionState: () => [{}, () => {}, false] },
    "@/app/actions/tree-milestones": {
      saveTreeMilestone: () => {}, deleteTreeMilestone: () => {}, saveMilestoneAdminConsent: () => {},
    },
  });
  const panel = loadModule("app/legacy-tree/tree-milestones-panel.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [{
      id: "grad", subjectType: "placeholder", subjectId: "child", title: "Graduation",
      kind: "graduation", year: 2035, month: 6, day: null, repeatsYearly: false, canEdit: true,
    }] },
    "@/lib/family-calendar-data": {
      getCalendarEvents: async () => [],
      getCalendarSettings: async () => ({ profile: {} }),
      getEditableCalendarSources: async () => [],
    },
    "@/app/family-calendar/calendar-forms": { ProfileDates: () => null, SourceDates: () => null },
    "./milestone-forms": formComponents,
  }).default;
  const html = renderToStaticMarkup(await panel({
    treeId: "tree", userId: "owner", isAdmin: true, allowAdmin: false,
    people: [{ id: "child", type: "placeholder", name: "Courtney", canEdit: true }],
  }));
  assert.match(html, /Family Milestones/);
  assert.match(html, /My milestone editing permission/);
  assert.match(html, /Courtney[\s\S]*Graduation[\s\S]*June 2035/);
  assert.match(html, /Add a milestone for Courtney/);
  assert.match(html, /Wedding Anniversary/);
  assert.match(html, /Custom Family Milestone/);
  assert.match(html, /name="subjectId" value="child"/);
  assert.match(html, /Saving shares this milestone/);
});

test("calendar renders month, week and agenda views with source labels", async () => {
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [] },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({
        profile: {}, reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner" }],
      }),
      getCalendarEvents: async () => [
        { id: "birthday", title: "Emma Birthday", date: "2020-05-04", repeatsYearly: true, source: "Legacy Tree™" },
      ],
      getEditableCalendarSources: async () => [],
      getFamilyBulletins: async () => [],
    },
    "./calendar-forms": Object.fromEntries(
      ["BulletinForm", "ImportDates", "ManualEvent", "ProfileDates", "ReminderSettings", "SourceDates"].map((name) => [name, () => null]),
    ),
  };
  const page = loadModule("app/family-calendar/page.tsx", dependencies).default;
  for (const view of ["month", "week", "agenda"]) {
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "tree", view, date: "2026-05-04" }) }));
    assert.match(html, /Emma Birthday/);
    assert.match(html, /Source: Legacy Tree™/);
    assert.match(html, new RegExp(`view=${view}`));
  }
  await assert.rejects(page({ searchParams: Promise.resolve({ tree: "other" }) }), /not found/);
});

test("empty calendar directs milestone management to the tree", async () => {
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [] },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ profile: {}, reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner" }] }),
      getCalendarEvents: async () => [],
      getEditableCalendarSources: async () => [],
      getFamilyBulletins: async () => [],
    },
    "./calendar-forms": Object.fromEntries(
      ["BulletinForm", "ImportDates", "ManualEvent", "ProfileDates", "ReminderSettings", "SourceDates"].map((name) => [name, () => null]),
    ),
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ date: "2026-05-04" }) }));
  assert.match(html, /❤️ Family Shout-Outs/);
  assert.match(html, /No family shout-outs yet/);
  assert.match(html, /Your Family Calendar is waiting for family dates/);
  assert.match(html, /Add milestones in your Legacy Tree/);
  assert.doesNotMatch(html, /Enable Family Date Sync/);
});

test("calendar forms explain sync, privacy, and full-date requirements", () => {
  const forms = loadModule("app/family-calendar/calendar-forms.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: { ...React, useActionState: () => [{}, () => {}, false] },
    "@/app/actions/family-calendar": Object.fromEntries(
      ["addRelationshipMilestone", "createCalendarEvent", "enableCalendarImports", "saveCalendarProfile",
        "saveCalendarReminders", "saveTreeSourceDate"].map((name) => [name, () => {}]),
    ),
  });
  const sync = renderToStaticMarkup(React.createElement(forms.ImportDates, { treeId: "tree" }));
  assert.match(sync, /Enable Family Date Sync/);
  const sharing = renderToStaticMarkup(React.createElement(forms.ProfileDates, { profile: {} }));
  assert.match(sharing, /private until you choose to share/);
  assert.match(sharing, /birth year alone cannot appear on the calendar/);
  const sources = renderToStaticMarkup(React.createElement(forms.SourceDates, { treeId: "tree", records: [] }));
  assert.match(sources, /visible to all members of this tree/);
  assert.match(sources, /accepted Connected Lives™ connection, both people in this tree, and both to share/);
  const shoutOut = renderToStaticMarkup(React.createElement(forms.BulletinForm, { treeId: "tree" }));
  assert.match(shoutOut, /What&#x27;s happening with the family today\?/);
  assert.match(shoutOut, /<textarea[^>]*aria-describedby="shout-out-limit"[\s\S]*?<\/textarea>[\s\S]*?<p id="shout-out-limit"[^>]*>300 characters maximum<\/p>/);
  assert.match(shoutOut, />Share Shout-Out<\/button>/);
});

test("family shout-outs retain author, time, message and existing deep links", async () => {
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [] },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ profile: {}, reminders: {}, trees: [{ id: "tree", name: "Family", role: "member" }] }),
      getCalendarEvents: async () => [],
      getFamilyBulletins: async () => [{ id: "note", authorName: "Enrique", createdAt: "2026-11-19T19:21:00Z", message: "Happy Birthday!" }],
    },
    "./calendar-forms": Object.fromEntries(
      ["BulletinForm", "ImportDates", "ManualEvent", "ProfileDates", "ReminderSettings", "SourceDates"].map((name) => [name, () => null]),
    ),
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "tree", date: "2026-11-19" }) }));
  assert.match(html, /Recent Family Shout-Outs/);
  assert.match(html, /id="bulletin-note"[\s\S]*?Enrique[\s\S]*?dateTime="2026-11-19T19:21:00Z"[\s\S]*?Happy Birthday!/);
});

test("family calendar authorization, consent and live imports in disposable PostgreSQL", {
  skip: process.env.FAMILY_CALENDAR_TEST_PGLITE ? false : "Set FAMILY_CALENDAR_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.FAMILY_CALENDAR_TEST_PGLITE);
  const db = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations")).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "014_family_calendar.sql"), "utf8"));
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    const now = "2026-01-01";
    for (const id of ["owner", "member", "outsider"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', $3, $3)`, [id, `${id}@example.test`, now]);
    }
    await db.exec(`
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at) VALUES ('tree', 'owner', 'Family', '${now}', '${now}');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES
        ('tree', 'owner', 'owner', '${now}'), ('tree', 'member', 'member', '${now}');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, birth_year, created_at, updated_at)
        VALUES ('placeholder', 'tree', 'owner', 'Grandparent', 'Grandparent', 1940, '${now}', '${now}'),
               ('year-only', 'tree', 'owner', 'Relative', 'Family', 1950, '${now}', '${now}');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at)
        VALUES ('future', 'owner', 'tree', 'Future child', 'Child', '${now}', '${now}');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
        VALUES ('connection', 'owner', 'member', 'Member', 'Family', 'accepted', '${now}', '${now}');
    `);
    let currentUser = "owner";
    const dependencies = {
      "node:crypto": { randomUUID: () => `event-${Math.random()}` },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { requireUser: async () => ({ id: currentUser }) },
      "@/lib/db": { getSql: () => sql },
      "@/lib/family-calendar": calendar,
      "server-only": {},
    };
    const actions = loadModule("app/actions/family-calendar.ts", dependencies);
    const data = loadModule("lib/family-calendar-data.ts", dependencies);
    const treeActions = loadModule("app/actions/tree-milestones.ts", dependencies);
    const treeData = loadModule("lib/tree-milestones-data.ts", dependencies);
    const save = (type, id, firstDate, secondDate = "") => actions.saveTreeSourceDate({}, form({
      treeId: "tree", sourceId: id, sourceType: type, firstDate, secondDate,
    }));
    const ids = async (id = "owner") => Array.from(await data.getCalendarEvents(id, "tree"), (event) => event.id);

    const addMilestone = (values) => treeActions.saveTreeMilestone({}, form({
      treeId: "tree", subjectType: "user", subjectId: "member", kind: "birthday", ...values,
    }));
    assert.ok((await addMilestone({ month: "5", day: "12" })).error);
    currentUser = "member";
    assert.ok((await addMilestone({ month: "2", day: "30" })).error);
    assert.ok((await addMilestone({ month: "5", day: "12" })).success);
    assert.ok((await addMilestone({ month: "5", day: "12" })).error);
    assert.ok((await actions.saveCalendarProfile({}, form({ birthDate: "1982-05-12", shareBirthday: "on" }))).error);
    let treeItems = await treeData.getTreeMilestones("owner", "tree");
    assert.equal(treeItems.length, 1);
    assert.equal(treeItems[0].year, null);
    assert.equal(treeItems[0].repeatsYearly, true);
    assert.equal(treeItems[0].canEdit, false);
    assert.equal((await treeData.getTreeMilestones("outsider", "tree")).length, 0);
    assert.ok((await treeActions.saveMilestoneAdminConsent({}, form({ treeId: "tree", allow: "on" }))).success);
    currentUser = "owner";
    assert.ok((await addMilestone({ kind: "custom", title: "First Day of College" })).success);
    assert.ok((await addMilestone({ subjectType: "placeholder", subjectId: "placeholder", kind: "graduation", year: "2035", month: "6" })).success);
    treeItems = await treeData.getTreeMilestones("owner", "tree");
    assert.equal(treeItems.length, 3);
    assert.ok(treeItems.every((item) => item.canEdit));
    const graduation = treeItems.find((item) => item.kind === "graduation");
    assert.equal(graduation.year, 2035);
    assert.equal(graduation.month, 6);
    assert.equal(graduation.day, null);
    assert.ok((await addMilestone({ subjectType: "placeholder", subjectId: "placeholder", kind: "graduation", milestoneId: graduation.id, year: "2035", month: "7" })).success);
    assert.equal((await treeData.getTreeMilestones("owner", "tree")).find((item) => item.id === graduation.id).month, 7);
    currentUser = "member";
    assert.ok((await treeActions.saveMilestoneAdminConsent({}, form({ treeId: "tree" }))).success);
    currentUser = "owner";
    const memberCustom = (await treeData.getTreeMilestones("owner", "tree")).find((item) => item.kind === "custom");
    assert.ok((await treeActions.deleteTreeMilestone({}, form({ treeId: "tree", milestoneId: memberCustom.id }))).error);
    assert.ok((await addMilestone({ kind: "custom", title: "Changed", milestoneId: memberCustom.id })).error);
    currentUser = "outsider";
    assert.ok((await addMilestone({ subjectType: "placeholder", subjectId: "placeholder", kind: "custom", title: "No" })).error);
    assert.ok((await treeActions.deleteTreeMilestone({}, form({ treeId: "tree", milestoneId: graduation.id }))).error);
    currentUser = "member";
    assert.ok((await treeActions.deleteTreeMilestone({}, form({ treeId: "tree", milestoneId: memberCustom.id }))).success);
    const memberBirthday = (await treeData.getTreeMilestones("member", "tree")).find((item) => item.kind === "birthday");
    assert.ok((await treeActions.deleteTreeMilestone({}, form({ treeId: "tree", milestoneId: memberBirthday.id }))).success);
    currentUser = "owner";

    assert.ok((await actions.createFamilyBulletin({}, form({ treeId: "tree", message: " " }))).error);
    assert.ok((await actions.createFamilyBulletin({}, form({ treeId: "tree", message: "x".repeat(301) }))).error);
    assert.ok((await actions.createFamilyBulletin({}, form({ treeId: "tree", message: "x".repeat(300) }))).success);
    assert.equal((await data.getFamilyBulletins("member", "tree"))[0].message.length, 300);
    assert.ok((await actions.createFamilyBulletin({}, form({ treeId: "tree", message: "❤️".repeat(301) }))).error);
    assert.ok((await actions.createFamilyBulletin({}, form({ treeId: "tree", message: "😀".repeat(300) }))).success);
    assert.equal((await data.getFamilyBulletins("member", null))[0].authorName, "owner");
    assert.equal((await data.getFamilyBulletins("outsider", "tree")).length, 0);
    assert.equal((await data.getFamilyBulletins("outsider", null)).length, 0);

    assert.ok((await save("placeholder", "placeholder", "1941-05-01")).error);
    assert.ok((await save("placeholder", "placeholder", "1940-05-01", "2020-06-01")).success);
    assert.ok((await save("future", "future", "2027-02-15")).success);
    assert.ok((await save("connection", "connection", "2010-06-14")).error);
    assert.ok((await actions.saveCalendarProfile({}, form({
      birthDate: "1980-03-01", shareBirthday: "on", shareAnniversary: "on", shareMilestones: "on",
    }))).success);
    assert.ok((await actions.addRelationshipMilestone({}, form({
      treeId: "tree", sourceId: "connection", title: "Graduation", date: "2028-05-25",
    }))).error);
    currentUser = "member";
    assert.ok((await save("placeholder", "placeholder", "1940-05-01")).error);
    assert.ok((await actions.createCalendarEvent({}, form({
      treeId: "tree", title: "Family Reunion", date: "2027-01-01", repeatsYearly: "on",
    }))).success);
    assert.ok((await ids()).includes("placeholder-birthday:placeholder"));
    assert.ok((await actions.enableCalendarImports({}, form({ treeId: "tree" }))).success);
    assert.ok((await actions.saveCalendarProfile({}, form({
      birthDate: "1982-02-01", shareBirthday: "on", shareAnniversary: "on", shareMilestones: "on",
    }))).success);
    assert.ok((await addMilestone({ month: "2", day: "1" })).error);
    assert.ok((await treeActions.saveMilestoneAdminConsent({}, form({ treeId: "tree", allow: "on" }))).success);
    assert.ok((await actions.saveCalendarReminders({}, form({ dayOf: "on", oneWeek: "on" }))).success);
    const prefs = await data.getCalendarSettings("member");
    assert.equal(prefs.reminders.dayOf, true);
    assert.equal(prefs.reminders.oneWeek, true);
    assert.equal(prefs.reminders.oneDay, false);
    assert.ok((await actions.saveCalendarReminders({}, form({ oneMonth: "on" }))).success);
    const updatedPrefs = await data.getCalendarSettings("member");
    assert.equal(updatedPrefs.reminders.dayOf, false);
    assert.equal(updatedPrefs.reminders.oneMonth, true);
    assert.equal((await data.getCalendarSettings("owner")).reminders.oneMonth, false);
    currentUser = "owner";
    assert.equal((await data.getEditableCalendarSources("owner", "tree")).find((record) => record.type === "user").firstDate, "1982-02-01");
    assert.ok((await save("user", "member", "1982-02-02")).success);
    currentUser = "member";
    assert.ok((await treeActions.saveMilestoneAdminConsent({}, form({ treeId: "tree" }))).success);
    currentUser = "owner";
    assert.ok((await save("user", "member", "1982-02-03")).error);
    assert.equal((await data.getEditableCalendarSources("owner", "tree")).some((record) => record.type === "user"), false);
    assert.ok((await save("connection", "connection", "2010-06-14")).success);
    assert.ok((await actions.addRelationshipMilestone({}, form({
      treeId: "tree", sourceId: "connection", title: "Graduation", date: "2028-05-25",
    }))).success);
    let events = await ids();
    for (const id of ["birthday:owner", "birthday:member", "placeholder-birthday:placeholder",
      "placeholder-memorial:placeholder", "future:future", "anniversary:connection"]) assert.ok(events.includes(id), id);
    assert.ok(events.some((id) => id.startsWith("event:")));
    assert.ok(events.some((id) => id.startsWith("milestone:")));
    assert.ok(!events.includes("placeholder-birthday:year-only"));
    assert.equal((await ids("outsider")).length, 0);

    currentUser = "outsider";
    assert.ok((await actions.enableCalendarImports({}, form({ treeId: "tree" }))).error);
    assert.ok((await actions.createCalendarEvent({}, form({ treeId: "tree", title: "Bad", date: "2027-01-01" }))).error);
    assert.ok((await actions.createFamilyBulletin({}, form({ treeId: "tree", message: "Unauthorized" }))).error);
    assert.ok((await save("connection", "connection", "2011-06-14")).error);

    await db.exec("UPDATE users SET share_birthday = FALSE, share_anniversary = FALSE, share_relationship_milestones = FALSE WHERE id = 'member'");
    events = await ids();
    assert.ok(!events.includes("birthday:member"));
    assert.ok(!events.includes("anniversary:connection"));
    assert.ok(!events.some((id) => id.startsWith("milestone:")));
    assert.equal((await data.getEditableCalendarSources("owner", "tree")).some((record) => record.type === "connection"), false);
    await db.exec("UPDATE users SET share_relationship_milestones = TRUE WHERE id = 'member'");
    const sharedMilestoneOnly = (await data.getEditableCalendarSources("owner", "tree")).find((record) => record.type === "connection");
    assert.equal(sharedMilestoneOnly.firstDate, "");
    assert.equal(sharedMilestoneOnly.canAnniversary, false);
    await db.exec("UPDATE users SET share_anniversary = TRUE, share_relationship_milestones = TRUE WHERE id = 'member'");
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'connection'");
    assert.ok(!(await ids()).includes("anniversary:connection"));
    await db.exec("UPDATE connected_lives SET status = 'accepted' WHERE id = 'connection'");
    currentUser = "member";
    assert.ok((await addMilestone({ kind: "custom", title: "Kept on rejoining" })).success);
    currentUser = "owner";
    await db.exec("DELETE FROM legacy_tree_members WHERE tree_id = 'tree' AND user_id = 'member'");
    assert.ok(!(await ids()).includes("anniversary:connection"));
    assert.equal((await ids("member")).length, 0);
    assert.equal((await data.getFamilyBulletins("member", "tree")).length, 0);
    assert.equal((await data.getFamilyBulletins("member", null)).length, 0);
    assert.equal((await treeData.getTreeMilestones("owner", "tree")).some((item) => item.title === "Kept on rejoining"), false);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM family_tree_milestones WHERE title = 'Kept on rejoining'")).rows[0].count, 1);
    await db.exec("INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'member', 'member', '2026-01-01')");
    assert.equal((await treeData.getTreeMilestones("member", "tree")).some((item) => item.title === "Kept on rejoining"), true);
    await db.exec("DELETE FROM legacy_tree_members WHERE tree_id = 'tree' AND user_id = 'member'");
    await db.exec("UPDATE future_moment_makers SET status = 'archived' WHERE id = 'future'");
    await db.exec("DELETE FROM family_placeholders WHERE id = 'placeholder'");
    events = await ids();
    assert.ok(!events.includes("future:future"));
    assert.ok(!events.includes("placeholder-birthday:placeholder"));
  } finally {
    await db.close();
  }
});

test("standalone schema and migration expose the same calendar columns", {
  skip: process.env.FAMILY_CALENDAR_TEST_PGLITE ? false : "Set FAMILY_CALENDAR_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.FAMILY_CALENDAR_TEST_PGLITE);
  const migrated = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations")).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) await migrated.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const query = `SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public' AND (
        table_name IN ('family_calendar_events', 'family_calendar_import_settings', 'family_calendar_reminders', 'family_relationship_milestones', 'family_bulletins', 'family_tree_milestones')
        OR (table_name = 'legacy_tree_members' AND column_name = 'allow_milestone_admin')
        OR (table_name = 'users' AND column_name IN ('birth_date', 'birth_year', 'memorial_date', 'share_birthday', 'share_anniversary', 'share_memorial_date', 'share_relationship_milestones'))
        OR (table_name = 'family_placeholders' AND column_name IN ('birth_date', 'memorial_date'))
        OR (table_name = 'future_moment_makers' AND column_name = 'expected_birth_date')
        OR (table_name = 'connected_lives' AND column_name = 'anniversary_date'))
      ORDER BY table_name, column_name`;
    assert.deepEqual((await migrated.query(query)).rows, (await bootstrap.query(query)).rows);
  } finally {
    await migrated.close();
    await bootstrap.close();
  }
});
