import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export const DEFAULT_GATEWAY = "http://localhost:4141";
export const DEFAULT_MODEL = "claude-sonnet-5-5-20260301";
export const CONFIG_FILE = "config.json";

export interface MaxConfig {
  stateDir: string;
  gateway: string;
  model: string;
  apiKey?: string;
}

type Environment = Readonly<Record<string, string | undefined>>;
type ConfigFile = Omit<MaxConfig, "stateDir" | "apiKey"> & { apiKey?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeGateway(value: string): string {
  if (value !== value.trim()) throw new Error("gateway must not contain surrounding whitespace");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`gateway must be an absolute URL, received ${JSON.stringify(value)}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`gateway must use http or https, received ${parsed.protocol}`);
  }
  if (parsed.username !== "" || parsed.password !== "") throw new Error("gateway must not contain credentials");
  if (parsed.search !== "" || parsed.hash !== "") throw new Error("gateway must not contain a query string or fragment");
  return parsed.href.replace(/\/+$/, "");
}

function parseConfigFile(value: unknown, path: string): ConfigFile {
  if (!isRecord(value)) throw new Error(`${path}: expected a JSON object`);
  const allowed = new Set(["gateway", "model", "apiKey"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${path}: unknown field ${JSON.stringify(key)}`);
  }
  const gateway = value.gateway ?? DEFAULT_GATEWAY;
  const model = value.model ?? DEFAULT_MODEL;
  const apiKey = value.apiKey;
  if (typeof gateway !== "string") throw new Error(`${path}: gateway must be a string`);
  if (typeof model !== "string" || model.trim() === "") throw new Error(`${path}: model must be a non-empty string`);
  if (apiKey !== undefined && typeof apiKey !== "string") throw new Error(`${path}: apiKey must be a string`);
  return { gateway: normalizeGateway(gateway), model, ...(apiKey === undefined ? {} : { apiKey }) };
}

export function resolveStateDir(env: Environment = process.env, home = homedir()): string {
  if (env.MAX_STATE_DIR !== undefined) {
    if (!isAbsolute(env.MAX_STATE_DIR)) throw new Error("MAX_STATE_DIR must be absolute");
    return env.MAX_STATE_DIR;
  }
  if (env.XDG_STATE_HOME !== undefined && isAbsolute(env.XDG_STATE_HOME)) return join(env.XDG_STATE_HOME, "max");
  return join(home, ".local", "state", "max");
}

export function loadConfig(env: Environment = process.env, home = homedir()): MaxConfig {
  const stateDir = resolveStateDir(env, home);
  const path = join(stateDir, CONFIG_FILE);
  let file: ConfigFile = { gateway: DEFAULT_GATEWAY, model: DEFAULT_MODEL };
  if (existsSync(path)) {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${path}: ${message}`);
    }
    file = parseConfigFile(value, path);
  }
  const gateway = normalizeGateway(env.MAX_GATEWAY_URL ?? file.gateway);
  const model = env.MAX_MODEL ?? file.model;
  const apiKey = env.MAX_API_KEY ?? file.apiKey;
  if (model.trim() === "") throw new Error("MAX_MODEL must be non-empty");
  return { stateDir, gateway, model, ...(apiKey === undefined ? {} : { apiKey }) };
}

export function initConfig(env: Environment = process.env, home = homedir()): { path: string; created: boolean } {
  const stateDir = resolveStateDir(env, home);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, CONFIG_FILE);
  const content = `${JSON.stringify({ gateway: DEFAULT_GATEWAY, model: DEFAULT_MODEL }, null, 2)}\n`;
  try {
    writeFileSync(path, content, { flag: "wx", mode: 0o600 });
    return { path, created: true };
  } catch (error) {
    if (isRecord(error) && error.code === "EEXIST") return { path, created: false };
    throw error;
  }
}
