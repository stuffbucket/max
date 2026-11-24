import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { initConfig, loadConfig, resolveStateDir } from "./config.ts";

test("resolveStateDir follows Max, XDG, then home precedence", () => {
  assert.equal(resolveStateDir({ MAX_STATE_DIR: "/max" }, "/home/u"), "/max");
  assert.equal(resolveStateDir({ XDG_STATE_HOME: "/state" }, "/home/u"), "/state/max");
  assert.equal(resolveStateDir({}, "/home/u"), "/home/u/.local/state/max");
  assert.throws(() => resolveStateDir({ MAX_STATE_DIR: "relative" }, "/home/u"), /absolute/);
});

test("loadConfig normalizes safe gateway URLs and rejects endpoint-confusing components", () => {
  assert.equal(loadConfig({ MAX_GATEWAY_URL: "HTTPS://EXAMPLE.COM/proxy///" }, "/home/u").gateway, "https://example.com/proxy");
  assert.throws(() => loadConfig({ MAX_GATEWAY_URL: " https://example.com" }, "/home/u"), /whitespace/);
  assert.throws(() => loadConfig({ MAX_GATEWAY_URL: "https://user:pass@example.com" }, "/home/u"), /credentials/);
  assert.throws(() => loadConfig({ MAX_GATEWAY_URL: "https://example.com/proxy?tenant=a" }, "/home/u"), /query string/);
  assert.throws(() => loadConfig({ MAX_GATEWAY_URL: "https://example.com/#fragment" }, "/home/u"), /fragment/);
});

test("loadConfig reads strict JSON and applies environment overrides", () => {
  const stateDir = mkdtempSync(join(tmpdir(), "max-config-"));
  try {
    writeFileSync(join(stateDir, "config.json"), JSON.stringify({ gateway: "https://file.example/", model: "file-model", apiKey: "file-key" }));
    const config = loadConfig(
      { MAX_STATE_DIR: stateDir, MAX_GATEWAY_URL: "https://env.example///", MAX_MODEL: "env-model", MAX_API_KEY: "env-key" },
      "/home/u",
    );
    assert.deepEqual(config, {
      stateDir,
      gateway: "https://env.example",
      model: "env-model",
      apiKey: "env-key",
    });
    writeFileSync(join(stateDir, "config.json"), JSON.stringify({ typo: true }));
    assert.throws(() => loadConfig({ MAX_STATE_DIR: stateDir }, "/home/u"), /unknown field/);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("initConfig creates once and never overwrites", () => {
  const root = mkdtempSync(join(tmpdir(), "max-init-"));
  const stateDir = join(root, "state");
  try {
    const first = initConfig({ MAX_STATE_DIR: stateDir }, "/home/u");
    assert.equal(first.created, true);
    const content = readFileSync(first.path, "utf8");
    const second = initConfig({ MAX_STATE_DIR: stateDir }, "/home/u");
    assert.equal(second.created, false);
    assert.equal(readFileSync(first.path, "utf8"), content);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
