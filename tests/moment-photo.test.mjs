import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function createPreparation({ invalidImage = false, missingContext = false, encode } = {}) {
  const calls = [];
  const revoked = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => missingContext ? null : { drawImage() {} },
    toBlob(callback, type, quality) {
      calls.push({ type, quality, width: canvas.width, height: canvas.height });
      callback(encode ? encode(type, quality) : new Blob(["photo"], { type }));
    },
  };
  class Image {
    naturalWidth = 3200;
    naturalHeight = 1600;
    set src(value) {
      assert.equal(value, "blob:test");
      queueMicrotask(() => invalidImage ? this.onerror?.() : this.onload?.());
    }
  }
  class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((data) => {
        this.result = `data:${blob.type};base64,${Buffer.from(data).toString("base64")}`;
        this.onload();
      });
    }
  }
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(root, "lib", "prepare-moment-photo.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Blob, FileReader,
    window: { Image, setTimeout, clearTimeout },
    document: { createElement: () => canvas },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: (url) => revoked.push(url) },
    require: (name) => {
      if (name !== "@/lib/convert-image") throw new Error(`Unexpected import: ${name}`);
      return {
        isHeicFile: async (file) => /\.heic$/i.test(file.name),
        toSupportedImage: async (file) => file,
      };
    },
  });
  return { prepare: exports.prepareMomentPhoto, calls, revoked };
}

test("moment photos are resized, encoded, and cleaned up with a JPEG fallback", async () => {
  const { prepare, calls, revoked } = createPreparation({
    encode: (type) => type === "image/webp" ? null : new Blob(["jpeg"], { type }),
  });
  const result = await prepare(new File(["image"], "family.jpg", { type: "image/jpeg" }));
  assert.equal(result.name, "family.jpg");
  assert.equal(result.data, "data:image/jpeg;base64,anBlZw==");
  assert.deepEqual(calls.map(({ type }) => type), ["image/webp", "image/jpeg"]);
  assert.equal(calls[0].width, 1600);
  assert.equal(calls[0].height, 800);
  assert.deepEqual(revoked, ["blob:test"]);
});

test("moment photos reject invalid or oversized input and release failed image resources", async () => {
  const { prepare } = createPreparation();
  await assert.rejects(prepare(new File(["x"], "notes.txt", { type: "text/plain" })), /Choose a JPG/);
  await assert.rejects(prepare(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" })), /20 MB/);
  for (const options of [{ invalidImage: true }, { missingContext: true }]) {
    const failed = createPreparation(options);
    await assert.rejects(failed.prepare(new File(["x"], "bad.jpg", { type: "image/jpeg" })));
    assert.deepEqual(failed.revoked, ["blob:test"]);
  }
});

test("moment photos retry compression until the image fits the storage limit", async () => {
  const { prepare, calls } = createPreparation({
    encode: (type, quality) => new Blob(
      [new Uint8Array(quality > 0.7 ? 640 * 1024 + 1 : 640 * 1024)],
      { type },
    ),
  });
  const result = await prepare(new File(["x"], "large.jpg", { type: "image/jpeg" }));
  assert.equal(Buffer.from(result.data.split(",")[1], "base64").length, 640 * 1024);
  assert.equal(calls.length, 2);
});
