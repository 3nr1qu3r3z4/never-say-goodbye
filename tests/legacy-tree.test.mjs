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

function loadModule(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Date,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function familyComponent(user, sql) {
  return loadModule("app/legacy-tree/family-members.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "next/link": { default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/image": { default: (props) => React.createElement("img", props) },
    "@/app/actions/family-tree": { createLegacyTree: async () => {} },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => sql },
    "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
    "./family-member-form": { default: () => React.createElement("div", null, "Family management form") },
    "./family-date-link": { default: ({ name }) => React.createElement("a", null, `Edit dates for ${name}`) },
    "./print-tree-button": loadModule("app/legacy-tree/print-tree-button.tsx", { "react/jsx-runtime": jsxRuntime, react: React }),
    "./tree-milestones-panel": { default: ({ treeId }) => React.createElement("div", null, `Milestones for ${treeId}`) },
  }).default;
}

async function renderFamily(component) {
  let element = await component();
  if (element.type.name === "FamilyMembersForUser") {
    element = await element.type(element.props);
  }
  return renderToStaticMarkup(element);
}

test("tree page never renders the hard-coded example family", () => {
  const page = loadModule("app/legacy-tree/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "./family-members": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(React.createElement(page));
  assert.doesNotMatch(html, /John Michael Doe|Mary Elizabeth Doe|James Michael Doe|Emma Rose Doe|Debbie Doe|Bobby Hayes/);
});

test("guests and users without a tree receive the empty state", async () => {
  const sql = () => ({});
  sql.transaction = async () => [[], [], [], [], []];
  for (const [user, createTarget, connectTarget] of [
    [null, "/signup", "/login"],
    [{ id: "owner" }, null, "/connected-lives"],
  ]) {
    const html = await renderFamily(familyComponent(user, sql));
    assert.match(html, /Your Legacy Tree is waiting to be built\./);
    assert.match(html, /Connect family members, add Future Moment Makers/);
    assert.match(html, /Create My Legacy Tree/);
    assert.match(html, /Connect Family/);
    if (createTarget) assert.ok(html.includes(`href="${createTarget}"`));
    else assert.match(html, /<form/);
    assert.ok(html.includes(`href="${connectTarget}"`));
    assert.doesNotMatch(html, /John Michael Doe|Debbie Doe/);
    assert.ok(html.indexOf("See What&#x27;s Possible") > html.indexOf("Your Legacy Tree is waiting to be built."));
    assert.match(html, /A fictional family example/);
    assert.match(html, /Build Your Legacy Tree/);
    assert.match(html, /Daniel Rivera/);
    assert.match(html, /Connect generations, preserve family history, and watch your family tree grow over time\./);
    assert.match(html, /Export Your Family Tree PDF/);
    assert.match(html, /src="\/images\/legacy-tree-pdf-preview\.png"/);
    assert.match(html, /Create a printable keepsake for family reunions, genealogy projects, memorials, and future generations\./);
  }
});

test("membership maps and tree navigation remain scoped and distinguish relationships", async () => {
  const sql = () => ({});
  sql.transaction = async () => [
    [{ id: "first", name: "First Tree", ownerId: "owner", ownerName: "Owner" }, { id: "second tree", name: "Second Tree", ownerId: "other", ownerName: "Other Owner" }],
    [{ id: "owner", treeId: "first", displayName: "Owner", relationship: "Family Member" }],
    [{ id: "future", treeId: "second tree", name: "Future Relative", relationship: "Child", status: "awaiting-claim" }],
    [{ id: "placeholder", treeId: "first", name: "Remembered Relative", relationship: "Grandparent", birthYear: null, deathYear: null, notes: null }],
    [],
  ];
  const html = await renderFamily(familyComponent({ id: "owner" }, sql));
  assert.doesNotMatch(html, /See What&#x27;s Possible/);
  assert.doesNotMatch(html, /View My Tree/);
  assert.match(html, /href="#family-members"[^>]*>Add Family Member/);
  assert.match(html, /href="#legacy-tree-item-first"/);
  assert.match(html, /href="#legacy-tree-item-second%20tree"/);
  assert.match(html, /id="legacy-tree-item-first" aria-label="First Tree"/);
  assert.match(html, /id="legacy-tree-item-second tree" aria-label="Second Tree"/);
  assert.doesNotMatch(html, />Family generations<|Family members are grouped by generation\./);
  assert.match(html, />Your household<\/h3>/);
  const first = html.slice(html.indexOf('id="legacy-tree-item-first"'), html.indexOf('id="legacy-tree-item-second tree"'));
  const second = html.slice(html.indexOf('id="legacy-tree-item-second tree"'), html.indexOf('id="family-members"'));
  assert.match(first, /Owner/);
  assert.match(first, /Remembered Relative/);
  assert.match(first, /action="\/api\/legacy-tree\/first\/pdf"[^>]*method="post"/i);
  assert.match(first, /Include relationship labels\?/);
  assert.match(first, /name="includeRelationshipLabels" checked="" value="no"/);
  assert.match(first, /name="includeRelationshipLabels" value="yes"/);
  assert.match(first, />Print Tree<\/button>/);
  assert.match(first, />Create PDF<\/button>/);
  assert.match(first, />Cancel<\/button>/);
  assert.match(first, /name="familyName" value=""/);
  assert.doesNotMatch(first, /Family name override|Use a different family name/);
  assert.doesNotMatch(first, /Future Relative/);
  assert.match(second, /Future Relative/);
  assert.match(second, /action="\/api\/legacy-tree\/second%20tree\/pdf"[^>]*method="post"/i);
  assert.doesNotMatch(second, /Remembered Relative/);
});

test("print dialog resets, closes on cancel or Escape, and returns focus", () => {
  const calls = [];
  const dialog = { showModal: () => calls.push("open"), close: () => calls.push("close") };
  const trigger = { focus: () => calls.push("focus") };
  const form = { reset: () => calls.push("reset") };
  const refs = [dialog, trigger, form];
  const PrintTreeButton = loadModule("app/legacy-tree/print-tree-button.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: { useId: () => "title", useRef: () => ({ current: refs.shift() }) },
  }).default;
  const element = PrintTreeButton({ treeId: "tree", className: "" });
  const [button, modal] = element.props.children;
  const [, modalForm] = modal.props.children;
  const [, , actions] = modalForm.props.children;

  button.props.onClick();
  assert.deepEqual(calls, ["reset", "open"]);
  actions.props.children[0].props.onClick();
  let prevented = false;
  modal.props.onKeyDown({ key: "Escape", preventDefault: () => { prevented = true; } });
  modal.props.onClose();
  assert.equal(prevented, true);
  assert.deepEqual(calls, ["reset", "open", "close", "close", "focus"]);
});

test("a tree containing only the viewer invites them to add family", async () => {
  const sql = () => ({});
  sql.transaction = async () => [
    [{ id: "tree", name: "My Tree", ownerId: "owner", ownerName: "Owner" }],
    [{ id: "owner", treeId: "tree", displayName: "Owner", relationship: "Family Member" }],
    [], [], [],
  ];
  const html = await renderFamily(familyComponent({ id: "owner" }, sql));
  assert.match(html, /Owner/);
  assert.match(html, /Tree owner · You/);
  assert.match(html, /Add family members to begin building this tree/);
  assert.match(html, /Family management form/);
});

test("date shortcuts appear only for people the viewer can manage", async () => {
  const sql = () => ({});
  sql.transaction = async () => [
    [{ id: "tree", name: "Family", ownerId: "owner", ownerName: "Owner" }],
    [
      { id: "owner", treeId: "tree", displayName: "Owner", role: "owner", relationship: null },
      { id: "allowed", treeId: "tree", displayName: "Allowed", allowAdmin: true, relationship: "Son" },
      { id: "private", treeId: "tree", displayName: "Private", allowAdmin: false, relationship: "Daughter" },
    ],
    [{ id: "future", treeId: "tree", name: "Future", relationship: "Grandchild", status: "awaiting-claim" }],
    [{ id: "placeholder", treeId: "tree", name: "Family", relationship: "Mother" }],
    [],
  ];
  const html = await renderFamily(familyComponent({ id: "owner" }, sql));
  for (const name of ["Owner", "Allowed", "Future", "Family"]) assert.ok(html.includes(`Edit dates for ${name}`));
  assert.doesNotMatch(html, /Edit dates for Private/);
});

test("family generations are based on owner-relative labels, not entry order", async () => {
  const sql = () => ({});
  sql.transaction = async () => [
    [{ id: "tree", name: "Family", ownerId: "owner", ownerName: "Owner" }],
    [
      { id: "daughter", treeId: "tree", displayName: "Daughter", relationship: "Daughter" },
      { id: "owner", treeId: "tree", displayName: "Owner", relationship: null },
      { id: "brother", treeId: "tree", displayName: "Brother", relationship: "Brother" },
      { id: "sister", treeId: "tree", displayName: "Sister", relationship: "Sister" },
      { id: "wife", treeId: "tree", displayName: "Wife", relationship: "Wife" },
      { id: "mom", treeId: "tree", displayName: "Mom", relationship: "Mom" },
    ],
    [{ id: "future", treeId: "tree", name: "Grandchild", relationship: "Grandchild", status: "awaiting-claim" }],
    [
      { id: "grandma", treeId: "tree", name: "Grandma", relationship: "Grandmother" },
      { id: "cousin", treeId: "tree", name: "Cousin", relationship: "Cousin" },
    ],
    [],
  ];
  const html = await renderFamily(familyComponent({ id: "brother" }, sql));
  const positions = ["Grandma", "Mom", "Brother", "Owner", "Wife", "Sister", "Daughter", "Grandchild", "Cousin"]
    .map((name) => html.indexOf(`>${name}</p>`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(html, /Tree owner<\/p>/);
  assert.match(html, /You · Brother/);
  for (const relationship of ["Wife", "Grandchild", "Grandmother"]) {
    assert.match(html, new RegExp(`>${relationship}</p><p class="mt-1 text-xs text-slate-400">Auto Placed</p>`));
  }
  assert.equal((html.match(/>Auto Placed<\/p>/g) ?? []).length, 7);
  assert.doesNotMatch(html, /This relationship was automatically positioned based on its label/);
  assert.match(html, /Relationships to review/);
  assert.match(html, /Relationship needs review/);
  assert.match(html, /Future Moment Maker™/);
  assert.match(html, /Family Placeholder/);
  assert.match(html, />Owner<\/p>[\s\S]*?data-tree-connector="household"[\s\S]*?>Wife<\/p>/);
  assert.match(html, /data-tree-connector="children"/);
});

test("household connectors do not invent partners or child branches", async () => {
  const sql = () => ({});
  const owner = { id: "owner", treeId: "tree", displayName: "Owner", relationship: null };
  const partner = { id: "partner", treeId: "tree", displayName: "Partner", relationship: "Partner" };
  const secondPartner = { id: "other", treeId: "tree", displayName: "Other", relationship: "Spouse" };
  const render = async (members) => {
    sql.transaction = async () => [
      [{ id: "tree", name: "Family", ownerId: "owner", ownerName: "Owner" }],
      members, [], [], [],
    ];
    return renderFamily(familyComponent({ id: "owner" }, sql));
  };
  assert.doesNotMatch(await render([owner]), /data-tree-connector=/);
  const couple = await render([owner, partner]);
  assert.match(couple, /data-tree-connector="household"/);
  assert.doesNotMatch(couple, /data-tree-connector="children"/);
  assert.doesNotMatch(await render([owner, partner, secondPartner]), /data-tree-connector=/);
  sql.transaction = async () => [
    [{ id: "tree", name: "Family", ownerId: "owner", ownerName: "Owner" }],
    [owner], [],
    [{ id: "placeholder", treeId: "tree", name: "Remembered Partner", relationship: "Spouse" }],
    [],
  ];
  assert.match(await renderFamily(familyComponent({ id: "owner" }, sql)), /data-tree-connector="household"[\s\S]*?>Remembered Partner<\/p>/);
});

test("parent and grandparent lines retain their owner or specific partner", async () => {
  const sql = () => ({});
  sql.transaction = async () => [
    [{ id: "tree", name: "Family", ownerId: "owner", ownerName: "Alex" }],
    [
      { id: "owner", treeId: "tree", displayName: "Alex", relationship: null },
      { id: "partner", treeId: "tree", displayName: "Sam", relationship: "Spouse" },
      { id: "mother", treeId: "tree", displayName: "Owner Mother", relationship: "Mother" },
      { id: "partner-mother", treeId: "tree", displayName: "Partner Mother", relationship: "Mother", linePartnerType: "member", linePartnerId: "partner" },
      { id: "missing-parent", treeId: "tree", displayName: "Other Parent", relationship: "Father", linePartnerType: "member", linePartnerId: "removed" },
    ],
    [{ id: "grandparent", treeId: "tree", name: "Partner Grandparent", relationship: "Grandmother", status: "awaiting-claim", linePartnerType: "member", linePartnerId: "partner" }],
    [
      { id: "father", treeId: "tree", name: "Owner Father", relationship: "Father" },
      { id: "partner-father", treeId: "tree", name: "Partner Father", relationship: "Father", birthYear: 1925, deathYear: 2016, notes: "Mi Papa", linePartnerType: "member", linePartnerId: "partner" },
    ],
    [],
  ];
  const html = await renderFamily(familyComponent({ id: "owner" }, sql));
  assert.match(html, /Alex&#x27;s Parents<\/h3>[\s\S]*?Owner Father[\s\S]*?Owner Mother/);
  assert.match(html, /Sam&#x27;s Parents<\/h3>[\s\S]*?Partner Father[\s\S]*?Father · 1925–2016[\s\S]*?Auto Placed[\s\S]*?Mi Papa[\s\S]*?Create a moment[\s\S]*?Partner Mother/);
  assert.match(html, /Sam&#x27;s Grandparents<\/h3>[\s\S]*?Partner Grandparent/);
  assert.match(html, /Relationships to review[\s\S]*?Other Parent[\s\S]*?Relationship needs review/);
  assert.doesNotMatch(html, /Relationship to /);
  assert.doesNotMatch(html, /Link a written moment to this person/);
  assert.match(html, /Create a moment/);
});

test("relationships are positioned relative to the selected person and unresolved references stay visible", async () => {
  const sql = () => ({});
  sql.transaction = async () => [
    [{ id: "tree", name: "Family", ownerId: "owner", ownerName: "Alex" }],
    [
      { id: "owner", treeId: "tree", displayName: "Alex", relationship: null },
      { id: "child", treeId: "tree", displayName: "Courtney", relationship: "Daughter" },
      { id: "grandmother", treeId: "tree", displayName: "Grandmother", relationship: "Grandmother", linePartnerType: "member", linePartnerId: "child" },
      { id: "mother", treeId: "tree", displayName: "Courtney Mother", relationship: "Mother", linePartnerType: "member", linePartnerId: "child" },
      { id: "unknown", treeId: "tree", displayName: "Unknown", relationship: "Cousin" },
      { id: "dependent", treeId: "tree", displayName: "Dependent", relationship: "Child", linePartnerType: "member", linePartnerId: "unknown" },
      { id: "cycle1", treeId: "tree", displayName: "Cycle One", relationship: "Parent", linePartnerType: "member", linePartnerId: "cycle2" },
      { id: "cycle2", treeId: "tree", displayName: "Cycle Two", relationship: "Child", linePartnerType: "member", linePartnerId: "cycle1" },
    ],
    [], [], [],
  ];
  const html = await renderFamily(familyComponent({ id: "owner" }, sql));
  assert.match(html, /Courtney&#x27;s Grandparents<\/h3>[\s\S]*?Grandmother/);
  assert.match(html, /Courtney&#x27;s Parents<\/h3>[\s\S]*?Courtney Mother/);
  assert.ok(html.indexOf("Courtney&#x27;s Grandparents") < html.indexOf("Your household"));
  const review = html.slice(html.indexOf("Relationships to review"));
  for (const name of ["Unknown", "Dependent", "Cycle One", "Cycle Two"]) assert.ok(review.includes(name));
});

test("family line migration keeps existing relatives on the owner line", {
  skip: process.env.LEGACY_TREE_TEST_PGLITE ? false : "Set LEGACY_TREE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.LEGACY_TREE_TEST_PGLITE);
  const db = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations.filter((file) => file < "025_")) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('tree', 'owner', 'Family', '2026-01-01', '2026-01-01');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, created_at, updated_at)
      VALUES ('parent', 'tree', 'owner', 'Parent', 'Mother', '2026-01-01', '2026-01-01');
    `);
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "025_tree_family_lines.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    const [parent] = (await db.query("SELECT name, relationship, line_partner_type, line_partner_id FROM family_placeholders WHERE id = 'parent'")).rows;
    assert.equal(parent.name, "Parent");
    assert.equal(parent.relationship, "Mother");
    assert.equal(parent.line_partner_type, null);
    assert.equal(parent.line_partner_id, null);
    await assert.rejects(db.exec("UPDATE family_placeholders SET line_partner_id = 'missing' WHERE id = 'parent'"), /check constraint/i);
  } finally {
    await db.close();
  }
});

test("only recognizable relationship labels receive a generation", () => {
  const { positionRelationship } = loadModule("lib/tree-positioning.ts", {});
  for (const [label, generation, partner] of [
    ["Grandfather", 2, false], ["Father", 1, false], ["sister", 0, false],
    ["Partner", 0, true], ["Son", -1, false], ["Granddaughter", -2, false],
  ]) {
    const result = positionRelationship(label);
    assert.equal(result.generation, generation);
    assert.equal(result.partner, partner);
  }
  for (const label of ["Cousin", "stepmother", "son-in-law", "", null]) {
    assert.equal(positionRelationship(label), null);
  }
});

function wizard({ userId = "owner", state = {}, search = async () => ({ results: [] }), additionalPeople = [] } = {}) {
  const values = [];
  let index = 0;
  let pending;
  const component = loadModule("app/legacy-tree/family-member-form.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
    react: {
      ...React,
      useState: (initial) => {
        const i = index++;
        if (!(i in values)) values[i] = initial;
        return [values[i], (value) => { values[i] = value; }];
      },
      useTransition: () => [false, (callback) => { pending = callback(); }],
      useActionState: () => [state, () => {}, false],
    },
    "@/app/actions/family-tree": { addFamilyMember: () => {}, searchFamilyMomentMakers: search },
  }).default;
  const props = {
    userId,
    trees: [
      { id: "first", name: "First", ownerId: "owner", ownerName: "Alex", people: [
        { type: "member", id: "viewer", name: "Viewer", isPartner: true },
        { type: "future", id: "child", name: "Courtney", isPartner: false },
        ...additionalPeople,
      ] },
      { id: "second", name: "Second", ownerId: "viewer", ownerName: "Viewer", people: [
        { type: "placeholder", id: "partner", name: "Jamie", isPartner: true },
      ] },
    ],
  };
  function render() { index = 0; return component(props); }
  function nodes(node = render()) {
    if (!React.isValidElement(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
  }
  function button(label) {
    const node = nodes().find((item) => item.type === "button" && item.props.children === label);
    assert.ok(node, `Missing button: ${label}`);
    return node;
  }
  function input(name) {
    const node = nodes().find((item) => item.type === "input" && item.props.name === name);
    assert.ok(node, `Missing input: ${name}`);
    return node;
  }
  return { render, nodes, button, input, wait: () => pending };
}

test("wizard preserves answers when going back and uses the selected person", () => {
  const w = wizard();
  assert.equal(w.input("relationshipTo").props.value, "owner");
  w.nodes().filter((node) => node.type === "select")[1].props.onChange({ target: { value: "member:viewer" } });
  w.button("Continue").props.onClick();
  w.button("Father").props.onClick();
  w.button("Continue").props.onClick();
  let fields = w.nodes().filter((node) => node.type === "input" && node.props.onChange);
  fields[0].props.onChange({ target: { value: "Robert" } });
  fields[1].props.onChange({ target: { value: "Smith" } });
  w.button("Back").props.onClick();
  assert.equal(w.button("Father").props["aria-pressed"], true);
  w.button("Back").props.onClick();
  assert.equal(w.nodes().filter((node) => node.type === "select")[1].props.value, "member:viewer");
  w.button("Continue").props.onClick();
  w.button("Continue").props.onClick();
  assert.equal(w.input("name").props.value, "Robert Smith");
  assert.equal(w.input("relationshipTo").props.value, "member:viewer");
  w.button("Continue").props.onClick();
  w.button("No").props.onClick();
  w.button("Continue").props.onClick();
  assert.ok(w.input("birthYear"));
  assert.ok(w.button("Skip and Add"));
  assert.equal(w.input("memberType").props.value, "placeholder");
});

test("wizard defaults Me to the signed-in member and limits options to the selected tree", () => {
  const w = wizard({ userId: "viewer" });
  assert.equal(w.input("relationshipTo").props.value, "member:viewer");
  let html = renderToStaticMarkup(w.render());
  assert.match(html, /Alex \(Spouse \/ Partner\)/);
  assert.match(html, /Viewer \(You\)/);
  w.nodes().find((node) => node.type === "select").props.onChange({ target: { value: "second" } });
  assert.equal(w.input("relationshipTo").props.value, "owner");
  html = renderToStaticMarkup(w.render());
  assert.match(html, /Jamie \(Spouse \/ Partner\)/);
  assert.doesNotMatch(html, /Courtney/);
});

test("wizard keeps a large family in a compact selector", () => {
  const additionalPeople = Array.from({ length: 100 }, (_, index) => ({
    type: "placeholder", id: `person-${index}`, name: `Person ${index}`, isPartner: false,
  }));
  const w = wizard({ additionalPeople });
  const selects = w.nodes().filter((node) => node.type === "select");
  assert.equal(selects.length, 2);
  const options = w.nodes(selects[1]).filter((node) => node.type === "option");
  assert.equal(options.length, 103);
  assert.equal(options[0].props.value, "owner");
  assert.equal(w.nodes().filter((node) => node.type === "button").length, 1);
  selects[1].props.onChange({ target: { value: "placeholder:person-99" } });
  w.button("Continue").props.onClick();
  assert.equal(w.input("relationshipTo").props.value, "placeholder:person-99");
});

test("wizard searches for an existing account and clears old results after revisiting the name", async () => {
  const w = wizard({ search: async (name) => ({ results: [{ id: "account", displayName: name }] }) });
  w.button("Continue").props.onClick();
  w.button("Mother").props.onClick();
  w.button("Continue").props.onClick();
  const fields = w.nodes().filter((node) => node.type === "input" && node.props.onChange);
  fields[0].props.onChange({ target: { value: "Jane" } });
  fields[1].props.onChange({ target: { value: "Doe" } });
  w.button("Continue").props.onClick();
  w.button("Yes").props.onClick();
  w.button("Search").props.onClick();
  await w.wait();
  w.button("Jane Doe").props.onClick();
  assert.equal(w.input("existingUserId").props.value, "account");
  w.button("Back").props.onClick();
  w.button("Continue").props.onClick();
  assert.equal(w.input("existingUserId").props.value, "");
  assert.equal(w.nodes().some((node) => node.type === "button" && node.props.children === "Jane Doe"), false);
  w.button("Add a Future Moment Maker™ instead").props.onClick();
  assert.equal(w.input("memberType").props.value, "future");
  assert.equal(w.button("Add Family Member").props.disabled, false);
});

test("add confirmation links to the tree returned by the server", () => {
  const w = wizard({ state: { success: "Added", treeId: "second tree" } });
  const html = renderToStaticMarkup(w.render());
  assert.match(html, /href="#legacy-tree-item-second%20tree"[^>]*>View My Tree/);
});

test("tree creation and membership-scoped display in disposable PostgreSQL", {
  skip: process.env.LEGACY_TREE_TEST_PGLITE ? false : "Set LEGACY_TREE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.LEGACY_TREE_TEST_PGLITE);
  const db = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    for (const id of ["owner", "relative", "outsider", "orphan", "rollback", "newmember", "line-member"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', '2026-01-01', '2026-01-01')`, [id, `${id}@example.test`]);
    }
    const sql = (strings, ...values) => ({
      text: strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, ""),
      values,
    });
    let failMembershipInsert = false;
    sql.transaction = async (queries) => db.transaction(async (tx) => {
      const results = [];
      for (const query of queries) {
        if (failMembershipInsert && query.text.includes("INSERT INTO legacy_tree_members")) {
          throw new Error("simulated membership failure");
        }
        results.push((await tx.query(query.text, query.values)).rows);
      }
      return results;
    });
    let user = { id: "owner", displayName: "Owner" };
    let sequence = 0;
    const actions = loadModule("app/actions/family-tree.ts", {
      "node:crypto": { randomUUID: () => `created-${++sequence}` },
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": { redirect: () => { throw new Error("redirect"); } },
      "@/lib/auth": { getCurrentUser: async () => user },
      "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
      "@/lib/db": { getSql: () => sql },
    });
    await Promise.all([actions.createLegacyTree(), actions.createLegacyTree()]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_trees WHERE owner_user_id = 'owner'")).rows[0].count, 1);
    const [tree] = (await db.query("SELECT id, name FROM legacy_trees WHERE owner_user_id = 'owner'")).rows;
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_tree_members WHERE tree_id = $1 AND user_id = 'owner'", [tree.id])).rows[0].count, 1);
    await db.query(`INSERT INTO legacy_tree_members (tree_id, user_id, relationship, role, joined_at) VALUES ($1, 'relative', 'Sibling', 'member', '2026-01-01')`, [tree.id]);
    await db.query(`INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, status, created_at, updated_at)
      VALUES ('future', 'owner', $1, 'Future Relative', 'Grandchild', 'claimed', '2026-01-01', '2026-01-01')`, [tree.id]);
    await db.query(`INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, created_at, updated_at)
      VALUES ('placeholder', $1, 'owner', 'Family History', 'Grandparent', '2026-01-01', '2026-01-01')`, [tree.id]);
    await db.exec(`
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('outsider-tree', 'outsider', 'Private Other Tree', '2026-01-01', '2026-01-01'),
             ('orphan-tree', 'orphan', 'Existing Tree', '2026-01-01', '2026-01-01'),
             ('second-tree', 'relative', 'Second Family Tree', '2026-01-02', '2026-01-02');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('outsider-tree', 'outsider', 'owner', '2026-01-01'),
             ('second-tree', 'owner', 'member', '2026-01-02');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, created_at, updated_at)
      VALUES ('second-placeholder', 'second-tree', 'owner', 'Second Tree Relative', 'Cousin', '2026-01-02', '2026-01-02');
      INSERT INTO moments (id, user_id, family_placeholder_id, kind, title, story, access_code_hash, created_at, updated_at)
      VALUES ('own', 'owner', 'placeholder', 'shared', 'Own Story', 'Visible story', NULL, '2026-01-01', '2026-01-01'),
             ('protected', 'owner', 'placeholder', 'shared', 'Protected Story', 'Hidden protected body', 'hash', '2026-01-01', '2026-01-01'),
             ('other', 'relative', 'placeholder', 'shared', 'Other Author Story', 'Hidden other body', NULL, '2026-01-01', '2026-01-01');
    `);
    const html = await renderFamily(familyComponent(user, sql));
    for (const text of ["owner", "relative", "Sibling", "Future Relative", "Claimed", "Family History", "Family management form", "Own Story", "Visible story", "Protected Story", "Protected or scheduled content is not shown here."]) {
      assert.ok(html.includes(text), `Expected ${text} in the rendered tree`);
    }
    assert.doesNotMatch(html, /Private Other Tree|outsider|John Michael Doe|Debbie Doe|Hidden protected body|Other Author Story|Hidden other body/);
    const secondTreeStart = html.indexOf('<section id="legacy-tree-item-second-tree" aria-label="Second Family Tree"');
    assert.ok(secondTreeStart > 0);
    const secondTreeEnd = html.indexOf("</section>", secondTreeStart);
    const secondTree = html.slice(secondTreeStart, secondTreeEnd);
    assert.ok(secondTree.includes("Second Tree Relative"));
    assert.equal(secondTree.includes("Family History"), false);
    assert.equal(html.slice(secondTreeEnd).includes("Second Tree Relative"), false);
    assert.equal(html.slice(0, secondTreeStart).includes("Second Tree Relative"), false);

    const directSql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    const addActions = loadModule("app/actions/family-tree.ts", {
      "node:crypto": { randomUUID: () => `added-${++sequence}` },
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": { redirect: () => { throw new Error("redirect"); } },
      "@/lib/auth": { getCurrentUser: async () => user },
      "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
      "@/lib/db": { getSql: () => directSql },
    });
    const add = async (type, extra) => {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        treeId: "second-tree", memberType: type, relationship: "Family", ...extra,
      })) form.set(key, value);
      return addActions.addFamilyMember({}, form);
    };
    await db.query("UPDATE users SET discoverability = 'private' WHERE id = 'outsider'");
    assert.equal((await addActions.searchFamilyMomentMakers("outsider")).results.length, 0);
    assert.equal((await addActions.searchFamilyMomentMakers("%")).results.length, 0);
    assert.ok((await addActions.searchFamilyMomentMakers("line-member")).results.some((result) => result.id === "line-member"));
    assert.match((await add("existing", { existingUserId: "outsider" })).error, /unavailable/);
    const added = await add("existing", { existingUserId: "newmember" });
    assert.match(added.success, /added/);
    assert.equal(added.treeId, "second-tree");
    const duplicate = await add("existing", { existingUserId: "newmember" });
    assert.match(duplicate.success, /already/);
    assert.equal(duplicate.treeId, "second-tree");
    for (const type of ["future", "placeholder"]) {
      const result = await add(type, { name: `Added ${type}` });
      assert.match(result.success, /added/);
      assert.equal(result.treeId, "second-tree");
    }
    const updatedHtml = await renderFamily(familyComponent(user, sql));
    const updatedSecondTree = updatedHtml.slice(
      updatedHtml.indexOf('<section id="legacy-tree-item-second-tree"'),
      updatedHtml.indexOf("</section>", updatedHtml.indexOf('<section id="legacy-tree-item-second-tree"')),
    );
    for (const name of ["newmember", "Added future", "Added placeholder"]) {
      assert.ok(updatedSecondTree.includes(name), `Expected ${name} in selected tree`);
    }
    const partnerResult = await add("placeholder", { name: "Partner", relationship: "Wife" });
    assert.ok(partnerResult.success);
    const ownerParent = await add("placeholder", { name: "Owner Parent", relationship: "Father" });
    assert.ok(ownerParent.success);
    const [partner] = (await db.query("SELECT id FROM family_placeholders WHERE name = 'Partner'")).rows;
    const linePartner = `placeholder:${partner.id}`;
    for (const [type, extra] of [
      ["existing", { existingUserId: "line-member" }],
      ["future", { name: "Partner Future Parent" }],
      ["placeholder", { name: "Partner Parent" }],
    ]) {
      const result = await add(type, { ...extra, relationship: "Mother", linePartner });
      assert.ok(result.success, `${type} should be assigned to the partner line`);
    }
    const invalid = await add("placeholder", { name: "Invalid", relationship: "Brother", relationshipTo: "bad-value" });
    assert.match(invalid.error, /valid person/);
    const wrongTree = await add("placeholder", { name: "Wrong Tree", relationship: "Mother", linePartner: "placeholder:placeholder" });
    assert.match(wrongTree.error, /not available/);
    const childResult = await add("future", { name: "Courtney", relationship: "Daughter" });
    assert.ok(childResult.success);
    const [child] = (await db.query("SELECT id FROM future_moment_makers WHERE name = 'Courtney'")).rows;
    const grandmother = await add("placeholder", {
      name: "Courtney Grandmother", relationship: "Grandmother", relationshipTo: `future:${child.id}`,
    });
    assert.ok(grandmother.success);
    const self = await add("existing", { existingUserId: "line-member", relationship: "Sibling", relationshipTo: "member:line-member" });
    assert.match(self.error, /themselves/);
    for (const [table, column, value] of [
      ["legacy_tree_members", "user_id", "line-member"],
      ["future_moment_makers", "name", "Partner Future Parent"],
      ["family_placeholders", "name", "Partner Parent"],
    ]) {
      const [row] = (await db.query(`SELECT line_partner_type, line_partner_id FROM ${table} WHERE ${column} = $1`, [value])).rows;
      assert.equal(row.line_partner_type, "placeholder");
      assert.equal(row.line_partner_id, partner.id);
    }
    const lineHtml = await renderFamily(familyComponent(user, sql));
    assert.match(lineHtml, /Partner&#x27;s Parents<\/h3>[\s\S]*?Partner Future Parent/);
    assert.match(lineHtml, /Partner&#x27;s Parents<\/h3>[\s\S]*?Partner Parent/);
    assert.match(lineHtml, /relative&#x27;s Parents<\/h3>[\s\S]*?Owner Parent/);
    assert.match(lineHtml, /Courtney&#x27;s Grandparents<\/h3>[\s\S]*?Courtney Grandmother/);
    user = { id: "outsider", displayName: "Outsider" };
    const denied = await add("placeholder", { name: "Unauthorized" });
    assert.match(denied.error, /tree you belong to/);
    assert.equal(denied.treeId, undefined);

    user = { id: "orphan", displayName: "Orphan" };
    await actions.createLegacyTree();
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_trees WHERE owner_user_id = 'orphan'")).rows[0].count, 1);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_tree_members WHERE tree_id = 'orphan-tree' AND user_id = 'orphan'")).rows[0].count, 1);
    user = { id: "rollback", displayName: "Rollback" };
    failMembershipInsert = true;
    await assert.rejects(actions.createLegacyTree(), /simulated membership failure/);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_trees WHERE owner_user_id = 'rollback'")).rows[0].count, 0);
    user = null;
    await assert.rejects(actions.createLegacyTree(), /redirect/);
  } finally {
    await db.close();
  }
});
