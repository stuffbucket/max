import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "./cli-args.ts";

test("parseArgs recognizes Max commands", () => {
  assert.deepEqual(parseArgs([]), { kind: "interactive" });
  assert.deepEqual(parseArgs(["doctor"]), { kind: "doctor" });
  assert.deepEqual(parseArgs(["models"]), { kind: "models" });
  assert.deepEqual(parseArgs(["browse", "https://example.com"]), { kind: "browse", url: "https://example.com" });
  assert.throws(() => parseArgs(["browse"]), /requires one absolute URL/);
  assert.deepEqual(parseArgs(["-p", "hello", "world"]), { kind: "print", prompt: "hello world" });
  assert.throws(() => parseArgs(["-p"]), /requires a prompt/);
  assert.throws(() => parseArgs(["wat"]), /unknown command/);
});
