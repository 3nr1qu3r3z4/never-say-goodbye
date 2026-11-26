import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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
