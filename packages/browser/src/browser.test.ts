import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeBrowserUrl, resolveBrowserExecutable } from "./browser.ts";

test("browser URLs are absolute HTTP(S) URLs", () => {
  assert.equal(normalizeBrowserUrl("HTTPS://EXAMPLE.COM/a b"), "https://example.com/a%20b");
  assert.throws(() => normalizeBrowserUrl("example.com"), /absolute/);
  assert.throws(() => normalizeBrowserUrl("file:///etc/passwd"), /http or https/);
  assert.throws(() => normalizeBrowserUrl("javascript:alert(1)"), /http or https/);
});

test("explicit browser executable is validated", () => {
  const root = mkdtempSync(join(tmpdir(), "max-browser-"));
  const executable = join(root, "chrome");
  try {
    writeFileSync(executable, "");
    assert.equal(resolveBrowserExecutable({ MAX_BROWSER_EXECUTABLE: executable }, "linux"), executable);
    assert.throws(() => resolveBrowserExecutable({ MAX_BROWSER_EXECUTABLE: join(root, "missing") }, "linux"), /does not exist/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
