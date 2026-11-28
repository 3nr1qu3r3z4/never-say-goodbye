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

function loadModule(relativePath, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "@/app/family-feed" && !(name in dependencies)) return {
        default: () => React.createElement("button", null, "Family Feed™"),
      };
      if (name === "./upcoming-family-moments" && !(name in dependencies)) return {
        default: loadModule("app/family-calendar/upcoming-family-moments.tsx", {
          react: React, "react/jsx-runtime": jsxRuntime, "@/lib/family-calendar": calendar,
          "@/app/family-event-dialog": { openFamilyEvent: () => {} },
        }).default,
      };
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
    Date,
    URLSearchParams, ...globals,
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

test("upcoming dates select the next real occurrence, including future starts and leap days", () => {
  const events = [
    { id: "past", title: "Past", date: "2026-03-01", repeatsYearly: false },
    { id: "today", title: "Today", date: "2026-03-10", repeatsYearly: false },
    { id: "tomorrow", title: "Tomorrow", date: "2026-03-11", repeatsYearly: false },
    { id: "yearless", title: "Birthday", date: "--01-02", repeatsYearly: true },
    { id: "leap", title: "Leap", date: "--02-29", repeatsYearly: true },
    { id: "future", title: "Future", date: "2030-01-03", repeatsYearly: true },
  ];
  assert.deepEqual(Array.from(calendar.upcomingOccurrences(events, "2026-03-10"), ({ id, date }) => `${id}:${date}`), [
    "today:2026-03-10", "tomorrow:2026-03-11", "yearless:2027-01-02", "leap:2028-02-29", "future:2030-01-03",
  ]);
});

test("upcoming section uses today rather than the browsed calendar date", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [] },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ reminders: {}, trees: [{ id: "tree", name: "Family", ownerId: "owner" }] }),
      getCalendarEvents: async () => [
        { id: "past", title: "Past event", date: yesterday, repeatsYearly: false },
        { id: "today", title: "Today event", date: today, repeatsYearly: false },
        { id: "tomorrow", title: "Tomorrow event", date: tomorrow, repeatsYearly: false },
      ],
    },
    "./calendar-forms": { CalendarActions: () => null },
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ date: "2040-01-01" }) }));
  const upcoming = html.match(/<section aria-labelledby="upcoming-family-moments"[\s\S]*?<\/section>/)?.[0];
  assert.ok(upcoming);
  assert.match(upcoming, /Today event[\s\S]*?>Today<\/time>[\s\S]*?Tomorrow event[\s\S]*?>Tomorrow<\/time>/);
  assert.doesNotMatch(upcoming, /Past event/);
  assert.ok(html.indexOf("Upcoming Family Moments") < html.indexOf('aria-label="Family calendar"'));
});

test("upcoming moments toggle between grid and compact list without changing dates", () => {
  let view = "grid";
  let controls = [];
  const reactState = React.useState;
  const capture = (factory) => (type, props, key) => {
    if (type === "button") controls.push(props);
    return factory(type, props, key);
  };
  const upcoming = loadModule("app/family-calendar/upcoming-family-moments.tsx", {
    react: { ...React, useState: (initial) => initial === "grid" ? [view, (next) => { view = next; }] : reactState(initial) },
    "react/jsx-runtime": { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) },
    "@/lib/family-calendar": calendar,
    "@/app/family-event-dialog": { openFamilyEvent: () => {} },
  }).default;
  const props = { today: "2026-03-10", tomorrow: "2026-03-11", treeId: "tree", events: [
    { id: "birthday:one", title: "Alex Birthday", date: "2026-03-11" },
    { id: "two", title: "Family Gathering", date: "2026-04-02" },
  ] };
  const render = () => { controls = []; return renderToStaticMarkup(upcoming(props)); };
  let html = render();
  assert.match(html, /sm:grid-cols-2/);
  assert.equal(controls.find((control) => control.children === "Grid")["aria-pressed"], true);
  controls.find((control) => control.children === "List").onClick();
  html = render();
  assert.doesNotMatch(html, /sm:grid-cols-2/);
  assert.match(html, /Alex Birthday[\s\S]*Tomorrow[\s\S]*Family Gathering[\s\S]*April 2/);
  assert.equal(controls.find((control) => control.children === "List")["aria-pressed"], true);
  controls.find((control) => control.children === "Grid").onClick();
  assert.match(render(), /sm:grid-cols-2/);
});

test("upcoming event cards open the event occurrence without note controls", () => {
  let controls = [], opened;
  const capture = (factory) => (type, props, key) => {
    if (type === "button") controls.push(props);
    return factory(type, props, key);
  };
  const upcoming = loadModule("app/family-calendar/upcoming-family-moments.tsx", {
    react: { useState: (initial) => [initial, () => {}] },
    "react/jsx-runtime": { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) },
    "@/lib/family-calendar": calendar,
    "@/app/family-event-dialog": { openFamilyEvent: (target) => { opened = target; } },
  }).default;
  const html = renderToStaticMarkup(upcoming({ treeId: "tree", today: "2026-03-10", tomorrow: "2026-03-11",
    events: [{ id: "birthday:one", title: "Alex Birthday", date: "2026-03-11" }] }));
  assert.match(html, /Alex Birthday[\s\S]*Tomorrow/);
  assert.doesNotMatch(html, /note|textarea/i);
  controls.find((control) => control.className?.includes("h-full w-full")).onClick();
  assert.equal(opened.treeId, "tree");
  assert.equal(opened.eventId, "birthday:one");
  assert.equal(opened.date, "2026-03-11");
});

test("event dialog loads a timeline, appends updates, and reports posting errors", async () => {
  const states = [], refs = [], effects = [], listeners = {}, controls = [];
  let stateIndex = 0, refIndex = 0, task, postResult = { error: "Try again." }, posted;
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: index === 0 ? dialog : initial };
      return refs[index];
    },
    useCallback: (callback) => callback,
    useEffect: (effect) => { effects.push(effect); },
    useTransition: () => [false, (callback) => { task = callback(); }],
  };
  const capture = (factory) => (type, props, key) => {
    if (type === "button" || type === "textarea" || type === "form" || type === "dialog") controls.push({ type, ...props });
    return factory(type, props, key);
  };
  const target = { treeId: "tree", eventId: "birthday:one", date: "2026-11-22" };
  const event = { id: target.eventId, title: "Birthday", date: target.date };
  const component = loadModule("app/family-event-dialog.tsx", {
    react,
    "react/jsx-runtime": { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) },
    "@/app/actions/family-calendar": {
      loadFamilyEvent: async () => ({ event, updates: [
        { id: "one", authorName: "Enrique", createdAt: "2026-11-22T17:42:00Z", message: "Dinner at 7" },
      ] }),
      postFamilyEventUpdate: async (_target, message) => {
        assert.equal(message, "Changed plans");
        return postResult;
      },
    },
  }, {
    window: {
      addEventListener: (name, handler) => { listeners[name] = handler; },
      removeEventListener: () => {},
      dispatchEvent: (message) => listeners[message.type](message),
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  const render = () => {
    stateIndex = 0; refIndex = 0; controls.length = 0; effects.length = 0;
    return renderToStaticMarkup(component.default({ onPosted: (...args) => { posted = args; } }));
  };
  render();
  effects[0]();
  component.openFamilyEvent(target);
  assert.equal(dialog.open, true);
  await new Promise((resolve) => setImmediate(resolve));
  let html = render();
  assert.match(html, /Birthday[\s\S]*November 22, 2026[\s\S]*Enrique[\s\S]*Dinner at 7/);
  controls.find((control) => control.type === "textarea").onChange({ target: { value: "Changed plans" } });
  render();
  controls.find((control) => control.type === "form").onSubmit({ preventDefault() {} });
  await task;
  assert.match(render(), /Try again/);
  postResult = { update: { id: "two", authorName: "Courtney", createdAt: "2026-11-24T10:15:00Z", message: "Changed plans" } };
  controls.find((control) => control.type === "form").onSubmit({ preventDefault() {} });
  await task;
  html = render();
  assert.match(html, /Enrique[\s\S]*Dinner at 7[\s\S]*Courtney[\s\S]*Changed plans/);
  assert.doesNotMatch(html, /Try again/);
  assert.equal(posted[0], target);
  assert.equal(controls.find((control) => control.type === "textarea").value, "");
  controls.find((control) => control.type === "button" && control["aria-label"] === "Close event").onClick();
  assert.equal(dialog.open, false);
});

test("calendar loads only the owned tree even when a different tree is requested", async () => {
  let trees = [
    { id: "joined", name: "Joined", ownerId: "other", role: "admin" },
    { id: "owned", name: "Owned", ownerId: "owner", role: "owner" },
  ];
  const loaded = [];
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async (_user, tree) => { loaded.push(tree); return []; } },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ reminders: {}, trees }),
      getCalendarEvents: async (_user, tree) => { loaded.push(tree); return []; },
    },
    "./calendar-forms": { CalendarActions: ({ treeId }) => React.createElement("span", null, `Actions: ${treeId ?? "none"}`) },
  }).default;
  let html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "joined" }) }));
  assert.deepEqual(loaded, ["owned", "owned"]);
  assert.match(html, /Actions: owned/);
  assert.doesNotMatch(html, /View Calendar|<select|aria-label="Calendar settings"/);
  trees = trees.slice(0, 1);
  loaded.length = 0;
  html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "joined" }) }));
  assert.deepEqual(loaded, []);
  assert.match(html, /Create your Legacy Tree™/);
  assert.match(html, /Actions: none/);
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
      getCalendarSettings: async () => ({ reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner", ownerId: "owner" }] }),
      getCalendarEvents: async () => [],
      getFamilyBulletins: async () => [],
    },
    "./calendar-forms": { CalendarActions: () => null },
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "tree", date: "2026-05-12" }) }));
  assert.match(html, /Courtney Birthday/);
  assert.match(html, /Milestones without an exact day[\s\S]*Courtney Graduation · June 2035/);
  assert.match(html, /Courtney First Day of College · Date not set/);
  assert.doesNotMatch(html, /2035-06-01/);
});

test("tree milestone panel keeps family dates and consent available without an expanded bulk list", async () => {
  const formComponents = loadModule("app/legacy-tree/milestone-forms.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: { ...React, useActionState: () => [{}, () => {}, false] },
    "@/app/actions/tree-milestones": {
      saveTreeMilestone: () => {}, deleteTreeMilestone: () => {}, saveMilestoneAdminConsent: () => {},
    },
  });
  const panel = loadModule("app/legacy-tree/tree-milestones-panel.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [{
      id: "grad", subjectType: "placeholder", subjectId: "child", title: "Graduation",
      kind: "graduation", year: 2035, month: 6, day: null, repeatsYearly: false, canEdit: true,
    }] },
    "@/lib/family-calendar-data": {
      getCalendarEvents: async () => [
        { id: "birthday:one", title: "Courtney Birthday", date: "2010-05-01", source: "Legacy Tree™" },
        { id: "anniversary:two", title: "Family Anniversary", date: "2012-06-01", source: "Connected Lives™" },
      ],
      getCalendarSettings: async () => ({ profile: {} }),
      getEditableCalendarSources: async () => [],
    },
    "./milestone-forms": formComponents,
    "./family-dates-manager": { default: () => React.createElement("div", null, "Family date selector") },
  }).default;
  const html = renderToStaticMarkup(await panel({
    treeId: "tree", userId: "owner", isAdmin: true, allowAdmin: false,
    people: [{ id: "child", type: "placeholder", name: "Courtney", canEdit: true }],
  }));
  assert.match(html, /Family Milestones/);
  assert.match(html, /My milestone editing permission/);
  assert.match(html, /Family date selector/);
  assert.match(html, /<details[^>]*><summary[^>]*>View Existing Family Dates →<\/summary>[\s\S]*Courtney Birthday/);
  assert.match(html, /<details[^>]*><summary[^>]*>View Shared Family Dates →<\/summary>[\s\S]*Family Anniversary/);
  assert.doesNotMatch(html, /<details[^>]* open/);
});

test("family date selector shows only the chosen person's editor and preserves relationship controls", () => {
  let selected = "";
  let listening = false;
  const listeners = new Set();
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const window = {
    addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener),
    dispatchEvent: (event) => { for (const listener of listeners) listener(event); },
  };
  const react = {
    ...React,
    useState: () => [selected, (value) => { selected = value; }],
    useEffect: (effect) => { if (!listening) { listening = true; effect(); } },
    useActionState: () => [{}, () => {}, false],
  };
  const calendarForms = loadModule("app/family-calendar/calendar-forms.tsx", {
    "react/jsx-runtime": jsxRuntime, react,
    "@/app/actions/family-calendar": Object.fromEntries(
      ["addRelationshipMilestone", "createCalendarEvent", "createFamilyBulletin", "enableCalendarImports", "saveCalendarProfile",
        "saveCalendarReminders", "saveTreeSourceDate"].map((name) => [name, () => {}]),
    ),
  });
  const milestoneForms = loadModule("app/legacy-tree/milestone-forms.tsx", {
    "react/jsx-runtime": jsxRuntime, react,
    "@/app/actions/tree-milestones": {
      saveTreeMilestone: () => {}, deleteTreeMilestone: () => {}, saveMilestoneAdminConsent: () => {},
    },
  });
  const manager = loadModule("app/legacy-tree/family-dates-manager.tsx", {
    "react/jsx-runtime": jsxRuntime, react,
    "@/app/family-calendar/calendar-forms": calendarForms,
    "@/lib/tree-milestones": milestones,
    "./milestone-forms": milestoneForms,
  }, { window, CustomEvent }).default;
  const props = {
    treeId: "tree", userId: "owner", profile: {},
    people: [
      { type: "user", id: "owner", name: "Alex", canEdit: true },
      { type: "placeholder", id: "child", name: "Courtney", canEdit: true },
      { type: "future", id: "future", name: "Bun", canEdit: true },
      { type: "user", id: "private", name: "Private", canEdit: false },
    ],
    sources: [
      { type: "placeholder", id: "child", name: "Courtney", firstDate: "2010-05-01", secondDate: "", canAnniversary: false, canMilestones: false },
      { type: "future", id: "future", name: "Bun", firstDate: "2030-01-01", secondDate: "", canAnniversary: false, canMilestones: false },
      { type: "connection", id: "pair", name: "Alex & Sam", firstDate: "", secondDate: "", canAnniversary: false, canMilestones: true },
    ],
    milestones: [{
      id: "grad", subjectType: "placeholder", subjectId: "child", title: "Graduation",
      kind: "graduation", year: 2035, month: 6, day: null, repeatsYearly: false, canEdit: true,
    }],
  };
  const nodes = (node) => !React.isValidElement(node) ? [] :
    [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
  const choose = (type, id) => {
    const select = nodes(manager(props)).find((node) => node.type === "select");
    select.props.onChange({ target: { value: JSON.stringify([type, id]) } });
  };
  let html = renderToStaticMarkup(manager(props));
  assert.match(html, /Who would you like to update\?/);
  assert.doesNotMatch(html, /name="firstDate"|Add a milestone for/);
  choose("placeholder", "child");
  html = renderToStaticMarkup(manager(props));
  assert.match(html, /<h5[^>]*>Courtney<\/h5>/);
  assert.match(html, /name="sourceId" value="child"/);
  assert.match(html, /name="firstDate" value="2010-05-01"/);
  assert.match(html, /name="secondDate"/);
  assert.match(html, /Manage Existing Dates →[\s\S]*Graduation[\s\S]*June 2035/);
  assert.match(html, /Add a milestone for Courtney/);
  assert.doesNotMatch(html, /<h5[^>]*>Bun<\/h5>/);
  choose("future", "future");
  html = renderToStaticMarkup(manager(props));
  assert.match(html, /Expected Birth Date/);
  assert.match(html, /name="firstDate" value="2030-01-01"/);
  assert.doesNotMatch(html, /name="secondDate"|name="sourceId" value="child"/);
  choose("connection", "pair");
  html = renderToStaticMarkup(manager(props));
  assert.match(html, /Add Relationship Milestone/);
  assert.doesNotMatch(html, /Anniversary Date|name="firstDate"/);
  choose("user", "owner");
  html = renderToStaticMarkup(manager(props));
  assert.match(html, /My Family Dates &amp; Sharing/);
  assert.match(html, /Share Birthday/);
  choose("user", "private");
  html = renderToStaticMarkup(manager(props));
  assert.match(html, /cannot edit this person/);
  assert.doesNotMatch(html, /name="firstDate"|Add a milestone for/);
  const link = loadModule("app/legacy-tree/family-date-link.tsx", { "react/jsx-runtime": jsxRuntime }, { window, CustomEvent }).default;
  const element = link({ treeId: "tree", type: "placeholder", id: "child", name: "Courtney" });
  assert.equal(element.props.href, "#family-dates-tree");
  element.props.onClick();
  assert.match(renderToStaticMarkup(manager(props)), /name="sourceId" value="child"/);
  const otherTree = link({ treeId: "other", type: "future", id: "future", name: "Bun" });
  otherTree.props.onClick();
  assert.match(renderToStaticMarkup(manager(props)), /name="sourceId" value="child"/);
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
        profile: {}, reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner", ownerId: "owner" }],
      }),
      getCalendarEvents: async () => [
        { id: "birthday", title: "Emma Birthday", date: "2020-05-04", repeatsYearly: true, source: "Legacy Tree™" },
      ],
      getEditableCalendarSources: async () => [],
      getFamilyBulletins: async () => [],
    },
    "./calendar-forms": Object.fromEntries(
      ["CalendarActions", "BulletinForm", "ImportDates", "ManualEvent", "ProfileDates", "ReminderSettings", "SourceDates"].map((name) => [name, () => null]),
    ),
  };
  const page = loadModule("app/family-calendar/page.tsx", dependencies).default;
  for (const view of ["month", "week", "agenda"]) {
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "tree", view, date: "2026-05-04" }) }));
    assert.match(html, /Emma Birthday/);
    assert.match(html, /Source: Legacy Tree™/);
    assert.match(html, new RegExp(`view=${view}`));
  }
  const otherLink = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "other", date: "2026-05-04" }) }));
  assert.match(otherLink, /Emma Birthday/);
  assert.doesNotMatch(otherLink, /Family tree<\/label>|View Calendar|managed in your Legacy Tree/);
});

test("calendar day cells distinguish past, today, future, and event dates across month boundaries", async () => {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-04-30T12:00:00Z"])); }
    static now() { return Date.parse("2026-04-30T12:00:00Z"); }
  }
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [
      { id: "m", kind: "graduation", personName: "Alex", title: "Graduation", year: 2026, month: 4, day: 29, repeatsYearly: false },
    ] },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ reminders: {}, trees: [{ id: "tree", ownerId: "owner" }] }),
      getCalendarEvents: async () => [
        { id: "event:one", title: "Past event", date: "2026-04-28", repeatsYearly: false, source: "Manual Event" },
        { id: "birthday:one", title: "Birthday", date: "2026-04-30", repeatsYearly: false, source: "Legacy Tree™" },
        { id: "anniversary:one", title: "Anniversary", date: "2026-05-01", repeatsYearly: false, source: "Connected Lives™" },
      ],
    },
    "./calendar-forms": { CalendarActions: () => null },
  }, { Date: FixedDate }).default;
  for (const view of ["month", "week"]) {
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ view, date: "2026-05-01" }) }));
    const day = (date) => {
      const match = html.match(new RegExp(`<div class="([^"]+)"><h3 class="([^"]+)"><time dateTime="${date}"[^>]*>[\\s\\S]*?<\\/h3>([\\s\\S]*?)<\\/div>`));
      assert.ok(match, `${view}: missing ${date}`);
      return { cell: match[1], heading: match[2], contents: match[3] };
    };
    for (const date of ["2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01"]) {
      assert.match(day(date).cell, /border-\[#d8a35b\]\/60/);
    }
    assert.match(day("2026-04-28").cell, /bg-black\/20/);
    assert.match(day("2026-04-28").contents, /text-slate-400/);
    assert.match(day("2026-04-30").cell, /bg-white/);
    assert.doesNotMatch(day("2026-04-30").cell, /opacity-60|bg-white\/\[/);
    assert.match(day("2026-04-30").heading, /text-slate-900/);
    assert.match(day("2026-04-30").contents, /bg-transparent text-slate-900[\s\S]*text-slate-600/);
    assert.match(day("2026-05-02").cell, /bg-white\/\[0\.06\]/);
    assert.doesNotMatch(day("2026-05-02").cell, /border-\[#d8a35b\]/);
  }
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
      getCalendarSettings: async () => ({ profile: {}, reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner", ownerId: "owner" }] }),
      getCalendarEvents: async () => [],
      getEditableCalendarSources: async () => [],
      getFamilyBulletins: async () => [],
    },
    "./calendar-forms": Object.fromEntries(
      ["CalendarActions", "BulletinForm", "ImportDates", "ManualEvent", "ProfileDates", "ReminderSettings", "SourceDates"].map((name) => [name, () => null]),
    ),
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ date: "2026-05-04" }) }));
  assert.match(html, /Upcoming Family Moments/);
  assert.match(html, /No upcoming family moments/);
  assert.match(html, /Family Feed™/);
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
  const shoutOut = renderToStaticMarkup(React.createElement(forms.BulletinForm, { treeId: "tree" }));
  assert.match(shoutOut, /What&#x27;s happening with the family today\?/);
  assert.match(shoutOut, /<textarea[^>]*aria-describedby="shout-out-limit"[\s\S]*?<\/textarea>[\s\S]*?<p id="shout-out-limit"[^>]*>300 characters maximum<\/p>/);
  assert.match(shoutOut, />Share Shout-Out<\/button>/);
});

test("calendar action controls open the event and reminder forms", () => {
  const dialogs = [{ open: false, showModal() { this.open = true; }, close() { this.open = false; } },
    { open: false, showModal() { this.open = true; }, close() { this.open = false; } }];
  let index = 0;
  const controls = [];
  const capture = (factory) => (type, props, key) => {
    if (type === "button" || type === "dialog") controls.push({ type, ...props });
    return factory(type, props, key);
  };
  const forms = loadModule("app/family-calendar/calendar-forms.tsx", {
    "react/jsx-runtime": { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) },
    react: { ...React, useRef: () => ({ current: dialogs[index++] }), useActionState: () => [{}, () => {}, false], useEffect: () => {} },
    "@/app/actions/family-calendar": Object.fromEntries(
      ["addRelationshipMilestone", "createCalendarEvent", "createFamilyBulletin", "enableCalendarImports", "saveCalendarProfile",
        "saveCalendarReminders", "saveTreeSourceDate"].map((name) => [name, () => {}]),
    ),
  });
  const html = renderToStaticMarkup(forms.CalendarActions({ treeId: "owned", reminders: { dayOf: true } }));
  assert.match(html, /name="treeId" value="owned"/);
  assert.match(html, /name="dayOf" checked=""/);
  controls.find((control) => control.type === "button" && control.children === "Add Event").onClick();
  controls.find((control) => control.type === "button" && control.children === "Reminders").onClick();
  assert.equal(dialogs[0].open, true);
  assert.equal(dialogs[1].open, true);
  controls.find((control) => control.type === "dialog" && control["aria-labelledby"] === "calendar-reminder-heading").onKeyDown({ key: "Escape" });
  assert.equal(dialogs[1].open, false);
});

test("calendar no longer renders shout-outs in its page content", async () => {
  const page = loadModule("app/family-calendar/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/family-calendar": calendar,
    "@/lib/tree-milestones": milestones,
    "@/lib/tree-milestones-data": { getTreeMilestones: async () => [] },
    "@/lib/family-calendar-data": {
      getCalendarSettings: async () => ({ profile: {}, reminders: {}, trees: [{ id: "tree", name: "Family", role: "owner", ownerId: "owner" }] }),
      getCalendarEvents: async () => [],
      getFamilyBulletins: async () => [{ id: "note", authorName: "Enrique", createdAt: "2026-11-19T19:21:00Z", message: "Happy Birthday!" }],
    },
    "./calendar-forms": Object.fromEntries(
      ["CalendarActions", "BulletinForm", "ImportDates", "ManualEvent", "ProfileDates", "ReminderSettings", "SourceDates"].map((name) => [name, () => null]),
    ),
  }).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ tree: "tree", date: "2026-11-19" }) }));
  assert.doesNotMatch(html, /Recent Family Shout-Outs|Happy Birthday!|bulletin-note/);
  assert.match(html, /Family Feed™/);
});

test("family feed opens linked shout-outs and updates, switches trees, refreshes, and ignores stale loads", async () => {
  const states = [], refs = [], effects = [], pending = [], listeners = {};
  let stateIndex = 0, refIndex = 0, controls = [], refreshes = 0, scrolled = "", openedEvent;
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: index === 0 ? dialog : initial };
      return refs[index];
    },
    useCallback: (callback) => callback,
    useEffect: (effect) => { effects.push(effect); },
  };
  const capture = (factory) => (type, props, key) => {
    if (type === "button" || type === "select" || type === "a" || type === "dialog" || type === BulletinForm) controls.push({ type, ...props });
    return factory(type, props, key);
  };
  const BulletinForm = () => React.createElement("div", null, "Shout-Out form");
  const windowMock = {
    location: { hash: "#bulletin-note", search: "?tree=one" },
    addEventListener: (name, handler) => { listeners[name] = handler; },
    removeEventListener: () => {},
    dispatchEvent: (event) => listeners[event.type](event),
  };
  const feed = loadModule("app/family-feed.tsx", {
    react,
    "react/jsx-runtime": { ...jsxRuntime, jsx: capture(jsxRuntime.jsx), jsxs: capture(jsxRuntime.jsxs) },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    "@/app/actions/family-calendar": { loadFamilyFeed: (tree) => new Promise((resolve) => pending.push({ tree, resolve })) },
    "@/app/family-calendar/calendar-forms": { BulletinForm },
    "@/app/family-event-dialog": { default: () => null, openFamilyEvent: (event) => { openedEvent = event; } },
  }, {
    window: windowMock,
    document: { getElementById: (id) => ({ scrollIntoView: () => { scrolled = id; } }) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  const render = () => {
    stateIndex = 0; refIndex = 0; controls = []; effects.length = 0;
    return renderToStaticMarkup(feed.default({}));
  };
  const data = (selectedTreeId, bulletins = [], updates = []) => ({
    trees: [{ id: "one", name: "One" }, { id: "two", name: "Two" }], selectedTreeId, bulletins, updates,
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  render();
  effects[0]();
  assert.equal(dialog.open, true);
  assert.equal(pending[0].tree, "one");
  pending[0].resolve(data("one", [{ id: "note", authorName: "Enrique", createdAt: "2026-11-19T19:21:00Z", message: "Hello family" }], [
    { id: "update", treeId: "two", treeName: "Two", eventId: "event:1", date: "2026-12-01",
      title: "Reunion", authorName: "Courtney", createdAt: "2026-11-20T19:21:00Z", message: "Bring cake" },
  ]));
  await settle();
  let html = render();
  effects[1]();
  assert.equal(scrolled, "bulletin-note");
  assert.match(html, /Enrique[\s\S]*?dateTime="2026-11-19T19:21:00Z"[\s\S]*?Hello family/);
  assert.match(html, /Family Updates[\s\S]*Reunion[\s\S]*Courtney[\s\S]*Bring cake/);
  controls.find((control) => control.type === "button" && control.className?.includes("w-full rounded-xl")).onClick();
  assert.equal(openedEvent.treeId, "two");
  assert.equal(openedEvent.eventId, "event:1");
  controls.find((control) => control.type === "select").onChange({ target: { value: "two" } });
  // A dashboard link can open another tree while the first request is still in flight.
  feed.FamilyFeedLink({ treeId: "one", bulletinId: "note" }).props.onClick({
    button: 0, preventDefault() {},
  });
  assert.equal(pending.at(-1).tree, "one");
  pending.at(-1).resolve(data("one"));
  await settle();
  pending[1].resolve(data("two"));
  await settle();
  html = render();
  assert.match(html, /No family shout-outs yet/);
  assert.equal(controls.find((control) => control.type === BulletinForm).treeId, "one");
  controls.find((control) => control.type === BulletinForm).onSuccess();
  assert.equal(refreshes, 1);
  assert.equal(pending.at(-1).tree, "one");
  pending.at(-1).resolve(data("one", [{ id: "new", authorName: "Family", createdAt: "2026-11-19T19:21:00Z", message: "New update" }]));
  await settle();
  assert.match(render(), /New update/);
  controls.find((control) => control.type === "select").onChange({ target: { value: "two" } });
  pending.at(-1).resolve({ error: "Could not load tree." });
  await settle();
  assert.match(render(), /Could not load tree/);
  controls.find((control) => control.type === "button" && control.children === "Try Again").onClick();
  assert.equal(pending.at(-1).tree, "two");
  pending.at(-1).resolve(data("two"));
  await settle();
  render();
  assert.equal(controls.find((control) => control.type === BulletinForm).treeId, "two");
  controls.find((control) => control.type === "button" && control.children === "Family Feed™").onClick();
  pending.at(-1).resolve({ error: "Sign in to view Family Feed™.", signIn: true });
  await settle();
  assert.match(render(), /href="\/login"[^>]*>Sign In/);
  controls.find((control) => control.type === "button" && control.children === "Family Feed™").onClick();
  pending.at(-1).resolve({ trees: [], selectedTreeId: null, bulletins: [] });
  await settle();
  assert.match(render(), /Create or join a .*Legacy Tree™/);
  controls.find((control) => control.type === "dialog").onKeyDown({ key: "Escape" });
  assert.equal(dialog.open, false);
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
    for (const id of ["owner", "member", "outsider", "otherowner"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', $3, $3)`, [id, `${id}@example.test`, now]);
    }
    await db.exec(`
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at) VALUES
        ('tree', 'owner', 'Family', '${now}', '${now}'),
        ('joined-tree', 'otherowner', 'Other Family', '${now}', '${now}');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES
        ('tree', 'owner', 'owner', '${now}'), ('tree', 'member', 'member', '${now}'),
        ('joined-tree', 'otherowner', 'owner', '${now}'), ('joined-tree', 'owner', 'admin', '${now}');
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
      "@/lib/auth": { requireUser: async () => ({ id: currentUser }), getCurrentUser: async () => currentUser ? { id: currentUser } : null },
      "@/lib/db": { getSql: () => sql },
      "@/lib/family-calendar": calendar,
      "server-only": {},
    };
    const data = loadModule("lib/family-calendar-data.ts", dependencies);
    dependencies["@/lib/family-calendar-data"] = data;
    const treeData = loadModule("lib/tree-milestones-data.ts", dependencies);
    dependencies["@/lib/tree-milestones-data"] = treeData;
    const actions = loadModule("app/actions/family-calendar.ts", dependencies);
    const accessibleTrees = (await data.getCalendarSettings("owner")).trees;
    assert.equal(accessibleTrees.find((tree) => tree.id === "tree").ownerId, "owner");
    assert.equal(accessibleTrees.find((tree) => tree.id === "joined-tree").ownerId, "otherowner");
    const treeActions = loadModule("app/actions/tree-milestones.ts", dependencies);
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "036_family_calendar_notes.sql"), "utf8"));
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "037_family_event_updates.sql"), "utf8"));
    const occurrenceDate = "2026-03-11";
    const nextYear = "2027-03-11";
    await db.query(`INSERT INTO family_calendar_events (id, tree_id, creator_user_id, title, event_date, repeats_yearly)
      VALUES ('note-event', 'tree', 'owner', 'Birthday', $1::date, TRUE),
             ('joined-event', 'joined-tree', 'otherowner', 'Reunion', $1::date, FALSE)`, [occurrenceDate]);
    await db.query(`INSERT INTO family_calendar_notes (user_id, tree_id, event_id, occurrence_date, note)
      VALUES ('owner', 'tree', 'event:note-event', $1::date, 'Private old note')`, [occurrenceDate]);
    const eventTarget = { treeId: "tree", eventId: "event:note-event", date: occurrenceDate };
    const yearTarget = { ...eventTarget, date: nextYear };
    const joinedTarget = { treeId: "joined-tree", eventId: "event:joined-event", date: occurrenceDate };
    assert.equal((await actions.loadFamilyEvent(eventTarget)).updates.length, 0);
    assert.equal((await actions.postFamilyEventUpdate(eventTarget, " Dinner at 7 ")).update.message, "Dinner at 7");
    assert.ok((await actions.postFamilyEventUpdate(eventTarget, " ")).error);
    assert.ok((await actions.postFamilyEventUpdate(eventTarget, "x".repeat(1001))).error);
    assert.ok((await actions.postFamilyEventUpdate({ ...eventTarget, date: "2026-02-30" }, "No")).error);
    assert.ok((await actions.postFamilyEventUpdate({ ...eventTarget, eventId: "event:missing" }, "No")).error);
    assert.ok((await actions.postFamilyEventUpdate({ ...eventTarget, treeId: "joined-tree" }, "No")).error);
    assert.ok((await actions.postFamilyEventUpdate({ ...joinedTarget, date: nextYear }, "No")).error);
    assert.equal((await actions.postFamilyEventUpdate(joinedTarget, "Reunion update")).update.message, "Reunion update");
    assert.deepEqual(Array.from((await actions.loadFamilyFeed("tree")).updates, (item) => item.treeId).sort(), ["joined-tree", "tree"]);
    currentUser = "member";
    assert.equal((await actions.postFamilyEventUpdate(eventTarget, "Changed plans")).update.message, "Changed plans");
    assert.equal((await actions.postFamilyEventUpdate(yearTarget, "Next year")).update.message, "Next year");
    const timeline = await actions.loadFamilyEvent(eventTarget);
    assert.deepEqual(Array.from(timeline.updates, (update) => update.message), ["Dinner at 7", "Changed plans"]);
    assert.deepEqual(Array.from(timeline.updates, (update) => update.authorName), ["owner", "member"]);
    assert.deepEqual(Array.from((await actions.loadFamilyEvent(yearTarget)).updates, (update) => update.message), ["Next year"]);
    assert.doesNotMatch(JSON.stringify(timeline), /Private old note/);
    assert.doesNotMatch(JSON.stringify(await actions.loadFamilyFeed(null)), /Private old note|Reunion update/);
    assert.ok((await actions.loadFamilyEvent(joinedTarget)).error);
    currentUser = "outsider";
    assert.ok((await actions.loadFamilyEvent(eventTarget)).error);
    assert.ok((await actions.postFamilyEventUpdate(eventTarget, "No")).error);
    assert.equal((await data.getFamilyEventUpdates("outsider")).length, 0);
    currentUser = "member";
    await db.exec("DELETE FROM legacy_tree_members WHERE tree_id = 'tree' AND user_id = 'member'");
    assert.ok((await actions.loadFamilyEvent(eventTarget)).error);
    assert.ok((await actions.postFamilyEventUpdate(eventTarget, "No")).error);
    assert.equal((await actions.loadFamilyFeed(null)).updates.length, 0);
    await db.query("INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'member', 'member', $1)", [now]);
    currentUser = "owner";
    assert.equal((await db.query("SELECT note FROM family_calendar_notes")).rows[0].note, "Private old note");
    await db.query("DELETE FROM family_calendar_events WHERE id = 'note-event'");
    assert.ok((await actions.loadFamilyEvent(eventTarget)).error);
    assert.equal((await actions.loadFamilyFeed(null)).updates.some((item) => item.eventId === eventTarget.eventId), false);
    await db.exec("UPDATE users SET birth_date = '2000-03-11', share_birthday = TRUE WHERE id = 'member'");
    const birthdayTarget = { treeId: "tree", eventId: "birthday:member", date: occurrenceDate };
    assert.equal((await actions.postFamilyEventUpdate(birthdayTarget, "Birthday plans")).update.message, "Birthday plans");
    await db.exec("UPDATE users SET share_birthday = FALSE WHERE id = 'member'");
    assert.ok((await actions.loadFamilyEvent(birthdayTarget)).error);
    assert.ok((await actions.postFamilyEventUpdate(birthdayTarget, "Hidden")).error);
    assert.equal((await actions.loadFamilyFeed(null)).updates.some((item) => item.eventId === birthdayTarget.eventId), false);
    await db.exec("UPDATE users SET birth_date = NULL WHERE id = 'member'");
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
    currentUser = "owner";
    const milestoneOccurrence = calendar.upcomingOccurrences(calendar.datedCalendarMilestones(treeItems), occurrenceDate)[0];
    const milestoneTarget = { treeId: "tree", eventId: milestoneOccurrence.id, date: milestoneOccurrence.date };
    assert.equal((await actions.postFamilyEventUpdate(milestoneTarget, "Bring cake")).update.message, "Bring cake");
    assert.equal((await actions.loadFamilyEvent(milestoneTarget)).updates[0].message, "Bring cake");
    currentUser = "member";
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
    currentUser = "member";
    assert.equal((await actions.loadFamilyFeed(null)).selectedTreeId, "tree");
    assert.equal((await actions.loadFamilyFeed("tree")).bulletins[0].message.length, 300);
    currentUser = "outsider";
    assert.ok((await actions.loadFamilyFeed("tree")).error);
    assert.equal((await actions.loadFamilyFeed(null)).selectedTreeId, null);
    currentUser = null;
    assert.equal((await actions.loadFamilyFeed("tree")).signIn, true);
    currentUser = "owner";
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
        table_name IN ('family_calendar_events', 'family_calendar_notes', 'family_event_updates', 'family_calendar_import_settings', 'family_calendar_reminders', 'family_relationship_milestones', 'family_bulletins', 'family_tree_milestones')
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
