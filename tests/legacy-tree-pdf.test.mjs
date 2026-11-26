import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeRequire = createRequire(import.meta.url);
function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText;
  const exports = {};
  const require = (name) => name in dependencies ? dependencies[name] : nativeRequire(name);
  require.resolve = nativeRequire.resolve;
  new Function("exports", "require", compiled)(exports, require);
  return exports;
}

const positioning = loadModule("lib/tree-positioning.ts");
const exportData = loadModule("lib/legacy-tree-export.ts", { "@/lib/tree-positioning": positioning });
const pdf = loadModule("lib/legacy-tree-pdf.ts", {
  "server-only": {},
  "@/lib/legacy-tree-export": exportData,
  "@/lib/tree-positioning": positioning,
});
const person = (id, name, relationship, extra = {}) => ({
  kind: "placeholder",
  data: { id, linePartnerType: null, linePartnerId: null },
  name, relationship, isOwner: false, birthYear: null, deathYear: null, isHonored: false,
  ...extra,
});

async function readPdf(bytes) {
  const document = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  const pages = [];
  for (let index = 1; index <= document.numPages; index++) {
    const page = await document.getPage(index);
    pages.push({ page, items: (await page.getTextContent()).items });
  }
  return { document, pages };
}

async function drawing(page) {
  const operators = await page.getOperatorList();
  const stack = [];
  let translation = [0, 0];
  const cards = [];
  const lines = [];
  for (let index = 0; index < operators.fnArray.length; index++) {
    const operation = operators.fnArray[index];
    const args = operators.argsArray[index];
    if (operation === OPS.save) stack.push([...translation]);
    if (operation === OPS.restore) translation = stack.pop();
    if (operation === OPS.transform) translation = [translation[0] + args[4], translation[1] + args[5]];
    if (operation === OPS.constructPath && args[0].length === 3) lines.push(args[2]);
    if (operation === OPS.constructPath && args[0].length === 5 && args[2][2] === 210) {
      cards.push({ x: translation[0] + 105, bottom: translation[1], top: translation[1] + args[2][3] });
    }
  }
  return { cards, lines };
}

function cardFor(name, items, cards) {
  const text = items.find((item) => item.str === name);
  assert.ok(text, `Missing ${name}`);
  const center = text.transform[4] + text.width / 2;
  const card = cards.find((entry) => Math.abs(entry.x - center) < 1 &&
    text.transform[5] > entry.bottom && text.transform[5] < entry.top);
  assert.ok(card, `Missing card for ${name}`);
  return card;
}

function vertical(lines, x, low, high) {
  return lines.some(([x1, y1, x2, y2]) => x1 === x && x2 === x && y1 <= low && y2 >= high);
}

function horizontal(lines, y, left, right) {
  return lines.some(([x1, y1, x2, y2]) => y1 === y && y2 === y && x1 <= left && x2 >= right);
}

test("export retains family lines, positioning, uncertain relatives and actual PDF text", async () => {
  const people = [
    person("owner", "Renée Reza", "", { kind: "member", isOwner: true }),
    person("partner", "Ima Reza", "Wife"),
    person("parent", "Dora Gallardo", "Mother", { birthYear: 1940, deathYear: 2020, isHonored: true }),
    person("relative", "Robert Smith", "Father", {
      data: { id: "relative", linePartnerType: "placeholder", linePartnerId: "partner" },
    }),
    person("uncertain", "林 美", "Cousin"),
  ];
  const sections = exportData.exportTreeSections(people, "Renée Reza");
  assert.deepEqual(Array.from(sections, (section) => section.label), [
    "Renée Reza's Parents", "Ima Reza's Parents", "Household", "Additional Family",
  ]);
  const bytes = await pdf.createLegacyTreePdf("Renée Reza", "Reza", people, new Date("2026-11-26T12:00:00Z"));
  const { pages } = await readPdf(bytes);
  assert.equal(pages.length, 1);
  assert.deepEqual(Array.from(pages[0].page.view), [0, 0, 792, 612]);
  const text = pages[0].items.map((item) => item.str).join("");
  for (const expected of ["The Reza Family", "Dora Gallardo", "1940–2020", "Honored Life™",
    "Robert Smith", "Additional Family", "林 美", "Build it today. Leave it forever.",
    "Never Say Goodbye™", "November 26, 2026"]) {
    assert.ok(text.includes(expected), `PDF missing ${expected}: ${text}`);
  }
  assert.doesNotMatch(text, /Auto Placed|Review|Create a Moment|Admin|Legacy Tree™/);
  assert.doesNotMatch(text, /Mother|Father/);
  assert.match(text, /Cousin/);
});

test("person cards are centered and only supported household connectors are drawn", async () => {
  const owner = person("owner", "Alex Owner", "", { kind: "member", isOwner: true });
  const partner = person("partner", "Jordan Owner", "Partner");
  const child = person("child", "Morgan Owner", "Child", { birthYear: 2005 });
  const create = async (people) => (await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date("2026-11-26T12:00:00Z")))).pages;
  const pages = await create([owner, partner, child]);
  const items = pages[0].items;
  const center = (name) => {
    const item = items.find((entry) => entry.str === name);
    assert.ok(item, `Missing ${name}`);
    return item.transform[4] + item.width / 2;
  };
  assert.ok(Math.abs((center("Alex Owner") + center("Jordan Owner")) / 2 - 396) < 1);
  assert.ok(Math.abs(center("Morgan Owner") - 396) < 1);
  assert.ok(items.some((item) => item.str.includes("Born 2005")));
  assert.ok(!items.some((item) => item.str === "Child"));
  const { cards, lines } = await drawing(pages[0].page);
  const ownerCard = cardFor("Alex Owner", items, cards);
  const childCard = cardFor("Morgan Owner", items, cards);
  assert.ok(vertical(lines, ownerCard.x, ownerCard.bottom - 10, ownerCard.bottom));
  assert.ok(horizontal(lines, ownerCard.bottom - 10, ownerCard.x, 396));
  assert.ok(vertical(lines, 396, childCard.top + 5, ownerCard.bottom - 10));
  assert.ok(vertical(lines, childCard.x, childCard.top, childCard.top + 5));
  assert.ok(!vertical(lines, 396, (ownerCard.top + ownerCard.bottom) / 2, (ownerCard.top + ownerCard.bottom) / 2));
  assert.ok(lines.some(([x1, y1, x2, y2]) =>
    x1 === ownerCard.x + 105 && x2 === ownerCard.x + 123 && y1 === y2));

  const multiplePartners = await create([owner, partner, person("second", "Taylor Owner", "Spouse"), child]);
  const multiDrawing = await drawing(multiplePartners[0].page);
  assert.ok(!multiDrawing.lines.some(([x1, y1, x2, y2]) => y1 === y2 && x2 - x1 === 18));
  assert.ok(multiDrawing.lines.length > 0);
  const onlyPartner = await create([owner, partner]);
  assert.equal((await drawing(onlyPartner[0].page)).lines.length, 1);
});

test("known parents and multiple children branch to the referenced person", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    person("partner", "Jordan Owner", "Partner"),
    person("parent1", "Dora Parent", "Mother"),
    person("parent2", "Elias Parent", "Father"),
    person("child1", "Bun Child", "Child"),
    person("child2", "Courtney Child", "Child"),
    person("child3", "Kalo Child", "Child"),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date("2026-11-26T12:00:00Z")));
  assert.equal(pages.length, 1);
  const { cards, lines } = await drawing(pages[0].page);
  const card = (name) => cardFor(name, pages[0].items, cards);
  const owner = card("Alex Owner");
  const parents = [card("Dora Parent"), card("Elias Parent")];
  const children = [card("Bun Child"), card("Courtney Child"), card("Kalo Child")];
  assert.ok(parents[0].bottom - owner.top >= 70);
  assert.ok(owner.bottom - children[0].top >= 70);
  for (const parent of parents) assert.ok(vertical(lines, parent.x, parent.bottom - 5, parent.bottom));
  assert.ok(vertical(lines, 396, owner.top + 10, parents[0].bottom - 5));
  assert.ok(horizontal(lines, owner.top + 10, owner.x, 396));
  assert.ok(vertical(lines, owner.x, owner.top, owner.top + 10));
  assert.ok(vertical(lines, owner.x, owner.bottom - 10, owner.bottom));
  assert.ok(horizontal(lines, owner.bottom - 10, owner.x, 396));
  assert.ok(vertical(lines, 396, children[0].top + 5, owner.bottom - 10));
  for (const child of children) assert.ok(vertical(lines, child.x, child.top, child.top + 5));
});

test("unresolved references remain in Additional Family without speculative connectors", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    person("relative", "Casey Relative", "Child", {
      data: { id: "relative", linePartnerType: "placeholder", linePartnerId: "missing" },
    }),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date()));
  const { cards, lines } = await drawing(pages[0].page);
  const relative = cardFor("Casey Relative", pages[0].items, cards);
  assert.ok(pages[0].items.some((item) => item.str.includes("Additional")));
  assert.ok(pages[0].items.some((item) => item.str === "Child"));
  assert.ok(!lines.some(([x1, y1, x2, y2]) =>
    x1 === relative.x && x2 === relative.x && (y1 === relative.top || y2 === relative.bottom)));
});

test("a referenced parent's line connects to the partner, not the owner", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    person("partner", "Jordan Owner", "Partner"),
    person("parent", "Pat Parent", "Mother", { data: { id: "parent", linePartnerType: "placeholder", linePartnerId: "partner" } }),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date()));
  const { cards, lines } = await drawing(pages[0].page);
  const partner = cardFor("Jordan Owner", pages[0].items, cards);
  const owner = cardFor("Alex Owner", pages[0].items, cards);
  const parent = cardFor("Pat Parent", pages[0].items, cards);
  assert.ok(vertical(lines, 396, partner.top + 10, parent.bottom - 5));
  assert.ok(horizontal(lines, partner.top + 10, 396, partner.x));
  assert.ok(vertical(lines, partner.x, partner.top, partner.top + 10));
  assert.ok(!vertical(lines, owner.x, owner.top, parent.bottom - 5));
});

test("both family lines connect to the appropriate household member", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    person("partner", "Jordan Owner", "Partner"),
    person("ownerParent", "Dora Parent", "Mother"),
    person("partnerParent", "Pat Parent", "Father", { data: { id: "partnerParent", linePartnerType: "placeholder", linePartnerId: "partner" } }),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date()));
  assert.equal(pages.length, 1);
  const { cards, lines } = await drawing(pages[0].page);
  const card = (name) => cardFor(name, pages[0].items, cards);
  const owner = card("Alex Owner");
  const partner = card("Jordan Owner");
  const ownerParent = card("Dora Parent");
  const partnerParent = card("Pat Parent");
  assert.ok(vertical(lines, ownerParent.x, ownerParent.bottom - 5, ownerParent.bottom));
  assert.ok(vertical(lines, owner.x, owner.top, owner.top + 5));
  assert.ok(vertical(lines, partnerParent.x, partnerParent.bottom - 5, partnerParent.bottom));
  assert.ok(vertical(lines, 396, partner.top + 10, partnerParent.bottom - 5));
  assert.ok(horizontal(lines, partner.top + 10, 396, partner.x));
  assert.ok(vertical(lines, partner.x, partner.top, partner.top + 10));
});

test("a child referenced to the partner branches from that partner", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    person("partner", "Jordan Owner", "Partner"),
    person("child", "Morgan Child", "Child", { data: { id: "child", linePartnerType: "placeholder", linePartnerId: "partner" } }),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date()));
  const { cards, lines } = await drawing(pages[0].page);
  const owner = cardFor("Alex Owner", pages[0].items, cards);
  const partner = cardFor("Jordan Owner", pages[0].items, cards);
  const child = cardFor("Morgan Child", pages[0].items, cards);
  assert.ok(vertical(lines, partner.x, partner.bottom - 10, partner.bottom));
  assert.ok(horizontal(lines, partner.bottom - 10, 396, partner.x));
  assert.ok(vertical(lines, 396, child.top + 5, partner.bottom - 10));
  assert.ok(!vertical(lines, owner.x, child.top + 5, owner.bottom));
});

test("multiple child rows stay connected without lines crossing person cards", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    ...Array.from({ length: 6 }, (_, index) => person(`child${index}`, `Child ${index}`, "Child")),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date()));
  assert.equal(pages.length, 1);
  const { cards, lines } = await drawing(pages[0].page);
  for (let index = 0; index < 6; index++) {
    const child = cardFor(`Child ${index}`, pages[0].items, cards);
    assert.ok(vertical(lines, child.x, child.top, child.top + 5));
  }
  for (const [x1, y1, x2, y2] of lines) {
    for (const card of cards) {
      const crosses = x1 === x2
        ? x1 > card.x - 105 && x1 < card.x + 105 && y1 < card.top && y2 > card.bottom
        : y1 > card.bottom && y1 < card.top && x1 < card.x + 105 && x2 > card.x - 105;
      assert.equal(crosses, false, "connector must not cross a card");
    }
  }
});

test("household connector does not cross a page break", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    person("partner", "Jordan Owner", "Partner"),
    person("child", "Morgan Owner", "Child"),
    ...Array.from({ length: 9 }, (_, index) => person(`parent${index}`, `Parent ${index}`, "Parent")),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date("2026-11-26T12:00:00Z")));
  assert.ok(pages.length > 1);
  assert.ok(pages[0].items.some((item) => item.str === "Alex Owner"));
  assert.ok(pages[1].items.some((item) => item.str === "Morgan Owner"));
  const paths = await Promise.all(pages.map(async ({ page }) => (await drawing(page)).lines));
  assert.ok(paths[0].some(([x1, y1, x2, y2]) => y1 === y2 && x2 - x1 === 18));
  assert.equal(paths[1].length, 0);
});

test("large trees continue across readable landscape pages without losing people", async () => {
  const people = [
    person("owner", "Alex Owner", "", { kind: "member", isOwner: true }),
    ...Array.from({ length: 125 }, (_, index) => person(`p${index}`, `Person ${String(index).padStart(3, "0")}`, "Child")),
  ];
  const { pages } = await readPdf(await pdf.createLegacyTreePdf("Alex Owner", "", people, new Date("2026-11-26T12:00:00Z")));
  assert.ok(pages.length > 1);
  const text = pages.flatMap(({ items }) => items.map((item) => item.str)).join("");
  for (let index = 0; index < 125; index++) {
    assert.ok(text.includes(`Person ${String(index).padStart(3, "0")}`));
  }
  for (const { page, items } of pages) {
    assert.deepEqual(Array.from(page.view), [0, 0, 792, 612]);
    assert.ok(items.some((item) => item.str.includes("Build it today.")));
    assert.ok(items.every((item) => item.transform[5] >= 20 && item.transform[5] <= 560));
  }
});

test("unsupported characters fail explicitly instead of producing missing glyphs", async () => {
  const people = [person("owner", "Owner 🦄", "", { kind: "member", isOwner: true })];
  await assert.rejects(pdf.createLegacyTreePdf("Owner 🦄", "", people, new Date()), pdf.UnsupportedTreeCharacterError);
});

test("export endpoint enforces authentication and tree membership before generating", async () => {
  let user = null;
  let tree = [];
  let calls = 0;
  const sql = () => ({});
  sql.transaction = async () => [tree, [], [], []];
  const route = loadModule("app/api/legacy-tree/[id]/pdf/route.ts", {
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => sql },
    "@/lib/legacy-tree-pdf": {
      createLegacyTreePdf: async () => { calls++; return new Uint8Array([37, 80, 68, 70]); },
      UnsupportedTreeCharacterError: pdf.UnsupportedTreeCharacterError,
    },
  });
  const makeRequest = () => {
    const body = new FormData();
    body.set("familyName", "");
    return new Request("http://localhost/api/legacy-tree/tree/pdf", { method: "POST", body });
  };
  const context = { params: Promise.resolve({ id: "tree" }) };
  assert.equal((await route.POST(makeRequest(), context)).status, 401);
  user = { id: "viewer" };
  assert.equal((await route.POST(makeRequest(), context)).status, 404);
  assert.equal(calls, 0);
  tree = [{ ownerId: "owner", ownerName: "Owner" }];
  const result = await route.POST(makeRequest(), context);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "application/pdf");
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(calls, 1);
});

test("export queries respect real tree membership and omit private content", {
  skip: process.env.LEGACY_TREE_TEST_PGLITE ? false : "Set LEGACY_TREE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = nativeRequire(process.env.LEGACY_TREE_TEST_PGLITE);
  const db = new PGlite();
  try {
    for (const file of fs.readdirSync(path.join(root, "db", "migrations")).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Alex', 'Owner', 'Alex Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('viewer', 'viewer@example.test', 'hash', 'Viewer', 'Person', 'Viewer', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('outsider', 'outsider@example.test', 'hash', 'Other', 'Person', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at) VALUES ('tree', 'owner', 'Family', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_tree_members (tree_id, user_id, relationship, role, joined_at) VALUES
        ('tree', 'owner', 'Family Member', 'owner', '2026-01-01'),
        ('tree', 'viewer', 'Sister', 'member', '2026-01-01');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, birth_year, death_year, notes, created_at, updated_at)
      VALUES ('mother', 'tree', 'owner', 'Dora', 'Mother', 1940, 2020, 'Private note', '2026-01-01', '2026-01-01');
      INSERT INTO honored_lives (family_placeholder_id, short_story) VALUES ('mother', 'Private story');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, status, created_at, updated_at)
      VALUES ('future', 'owner', 'tree', 'Future Child', 'Child', 'awaiting-claim', '2026-01-01', '2026-01-01'),
             ('archived', 'owner', 'tree', 'Archived Child', 'Child', 'archived', '2026-01-01', '2026-01-01');
    `);
    const sql = (strings, ...values) => ({
      text: strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, ""),
      values,
    });
    sql.transaction = (queries) => db.transaction(async (tx) => {
      const results = [];
      for (const query of queries) results.push((await tx.query(query.text, query.values)).rows);
      return results;
    });
    let user = { id: "outsider" };
    const route = loadModule("app/api/legacy-tree/[id]/pdf/route.ts", {
      "@/lib/auth": { getCurrentUser: async () => user },
      "@/lib/db": { getSql: () => sql },
      "@/lib/legacy-tree-pdf": pdf,
    });
    const request = () => {
      const body = new FormData();
      body.set("familyName", "");
      return new Request("http://localhost/api/legacy-tree/tree/pdf", { method: "POST", body });
    };
    const context = { params: Promise.resolve({ id: "tree" }) };
    assert.equal((await route.POST(request(), context)).status, 404);
    user = { id: "viewer" };
    const result = await route.POST(request(), context);
    assert.equal(result.status, 200);
    const { pages } = await readPdf(await result.arrayBuffer());
    const text = pages.flatMap(({ items }) => items.map((item) => item.str)).join("");
    for (const value of ["Alex Owner", "Viewer", "Dora", "1940–2020", "Honored Life™", "Future Child"]) assert.ok(text.includes(value), value);
    assert.doesNotMatch(text, /Private note|Private story|Archived Child|Other/);
  } finally {
    await db.close();
  }
});
