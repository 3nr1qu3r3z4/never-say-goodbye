import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, "lib", "convert-image.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });

test("format detection reports a successful file header read", async () => {
  const stages = [];
  const file = {
    name: "photo.jpg",
    type: "image/jpeg",
    slice: () => ({ arrayBuffer: async () => new Uint8Array(32).buffer }),
  };
  assert.equal(await exports.isHeicFile(file, (stage) => stages.push(stage)), false);
  assert.deepEqual(stages, ["file header read started", "file header read completed"]);
});

test("format detection reports the read stage and propagates an unreadable file", async () => {
  const stages = [];
  const failure = new Error("file unavailable");
  const file = {
    name: "photo.jpg",
    type: "image/jpeg",
    slice: () => ({ arrayBuffer: async () => { throw failure; } }),
  };
  await assert.rejects(exports.isHeicFile(file, (stage) => stages.push(stage)), failure);
  assert.deepEqual(stages, ["file header read started"]);
});

test("conversion forwards header-read diagnostics for a supported image", async () => {
  const stages = [];
  const file = {
    name: "photo.jpg",
    type: "image/jpeg",
    slice: () => ({ arrayBuffer: async () => new Uint8Array(32).buffer }),
  };
  assert.equal(await exports.toSupportedImage(file, (stage) => stages.push(stage)), file);
  assert.deepEqual(stages, [
    "format detection started",
    "file header read started",
    "file header read completed",
    "conversion not needed",
  ]);
});
