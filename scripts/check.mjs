#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const projects = JSON.parse(execFileSync("pnpm", ["list", "--recursive", "--depth", "-1", "--json"], { cwd: root, encoding: "utf8" }));
if (!Array.isArray(projects)) throw new Error("pnpm returned an invalid workspace project list");
const manifestPaths = projects.map((project) => {
  if (!project || typeof project !== "object" || typeof project.path !== "string") {
    throw new Error("pnpm returned a workspace project without a path");
  }
  const fromRoot = relative(root, resolve(project.path));
  if (fromRoot.startsWith("..") || resolve(root, fromRoot) !== resolve(project.path)) {
    throw new Error(`workspace project lies outside the repository: ${project.path}`);
  }
  return (fromRoot === "" ? "package.json" : join(fromRoot, "package.json")).replaceAll("\\", "/");
});
const manifests = manifestPaths.map((path) => ({ path, value: JSON.parse(readFileSync(join(root, path), "utf8")) }));
const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
const forbidden = ["@earendil-works/pi-ai", "@earendil-works/pi-agent-core", "@earendil-works/pi-coding-agent"];

for (const { path, value } of manifests) {
  const declared = { ...value.dependencies, ...value.devDependencies, ...value.optionalDependencies };
  for (const name of Object.keys(declared)) {
    if (forbidden.includes(name)) problems.push(`${path}: forbidden dependency ${name}`);
    if (name.startsWith("@earendil-works/") && name !== "@earendil-works/pi-tui") {
      problems.push(`${path}: ${name} crosses Max's Pi dependency boundary`);
    }
  }
}
for (const name of forbidden) {
  if (lock.includes(name)) problems.push(`pnpm-lock.yaml: forbidden dependency ${name}`);
}

const rootManifest = manifests.find(({ path }) => path === "package.json")?.value;
if (rootManifest === undefined) throw new Error("pnpm workspace list did not include the repository root");
const rule = rootManifest.pnpmTarballUrlPolicy?.rules?.[0];
const registry = execFileSync("pnpm", ["config", "get", "registry"], { cwd: root, encoding: "utf8" }).trim();
if (registry !== rule?.registry) problems.push(`pnpm resolves from ${registry}, expected ${rule?.registry ?? "a configured proxy"}`);

// Dependabot can reach only registries declared in its own config, not ones set in .npmrc.
const dependabot = readFileSync(join(root, ".github", "dependabot.yml"), "utf8");
const proxyName = [...dependabot.matchAll(/^ {2}([\w-]+):\n {4}type: npm-registry\n {4}url: (\S+)$/gm)].find(
  ([, , url]) => url === rule?.registry,
)?.[1];
const npmUpdate = dependabot.split(/^ {2}- package-ecosystem: /m).find((block) => block.startsWith("npm\n"));
if (proxyName === undefined) {
  problems.push(`.github/dependabot.yml: no npm-registry declares ${rule?.registry ?? "the configured proxy"}`);
} else if (npmUpdate === undefined || !new RegExp(`^ {6}- ${proxyName}$`, "m").test(npmUpdate)) {
  problems.push(`.github/dependabot.yml: the npm update does not use registry ${proxyName}`);
}

const mise = readFileSync(join(root, "mise.toml"), "utf8");
const misePnpm = /^pnpm = "(.+)"$/m.exec(mise)?.[1];
if (rootManifest.packageManager !== `pnpm@${misePnpm}`) {
  problems.push(`package.json pins ${rootManifest.packageManager}, mise.toml pins pnpm ${misePnpm}`);
}

for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
console.log("workspace policy ok");
