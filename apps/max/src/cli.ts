#!/usr/bin/env node
import { Agent } from "@stuffbucket/max-agent";
import { MaximalGateway } from "@stuffbucket/maximal-client";
import { runBrowserTui } from "./browser-tui.js";
import { parseArgs } from "./cli-args.js";
import { initConfig, loadConfig } from "./config.js";
import { runInteractive } from "./interactive.js";
import { sanitizeTerminalText } from "./terminal-sanitize.js";

const VERSION = "0.0.0";
const HELP = `Max — a Maximal-native terminal coding agent

Usage:
  max                         Start an interactive session
  max -p, --print <prompt>    Run one prompt and print the reply
  max models                  List models served by Maximal
  max browse <url>            Open an interactive Chromium view through Kitty graphics
  max doctor                  Check local configuration and gateway access
  max init                    Create the default state and config file
  max --version               Print the version

Environment:
  MAX_STATE_DIR    State directory (default: ~/.local/state/max)
  MAX_GATEWAY_URL  Maximal gateway (default: http://localhost:4141)
  MAX_MODEL        Model id
  MAX_API_KEY      Optional gateway bearer token
`;

function printLine(text: string): void {
  console.log(sanitizeTerminalText(text));
}

function gateway() {
  const config = loadConfig();
  return { config, client: new MaximalGateway({ baseUrl: config.gateway, ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey }) }) };
}

async function main(args: readonly string[]): Promise<void> {
  const command = parseArgs(args);
  if (command.kind === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (command.kind === "version") {
    printLine(VERSION);
    return;
  }
  if (command.kind === "init") {
    const result = initConfig();
    printLine(`${result.created ? "created" : "kept"} ${result.path}`);
    return;
  }
  if (command.kind === "browse") {
    await runBrowserTui(command.url);
    return;
  }

  const { config, client } = gateway();
  if (command.kind === "models") {
    const models = await client.listModels(AbortSignal.timeout(5_000));
    for (const model of models) printLine(`${model.id}${model.name === undefined ? "" : `\t${model.name}`}`);
    return;
  }
  if (command.kind === "doctor") {
    const models = await client.listModels(AbortSignal.timeout(5_000));
    const selected = models.some((model) => model.id === config.model);
    printLine(`ok node ${process.versions.node}`);
    printLine(`ok state ${config.stateDir}`);
    printLine(`ok gateway ${config.gateway} (${models.length} models)`);
    printLine(`${selected ? "ok" : "error"} model ${config.model}${selected ? "" : " (not in gateway catalog)"}`);
    if (!selected) process.exitCode = 1;
    return;
  }

  const agent = new Agent({
    client,
    model: config.model,
    system: "You are Max, a concise coding assistant running on the Maximal gateway.",
  });
  if (command.kind === "print") {
    printLine(await agent.prompt(command.prompt));
    return;
  }
  await runInteractive(agent, config);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(sanitizeTerminalText(`max: ${error instanceof Error ? error.message : String(error)}`));
  process.exitCode = 1;
});
