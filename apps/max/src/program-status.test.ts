import assert from "node:assert/strict";
import test from "node:test";
import type { ProgramStatus } from "@earendil-works/pi-tui";
import {
  formatOsc26,
  formatOsc9999,
  MaxProgramStatusReporter,
  type MaxProgramStatus,
  type ProgramStatusTerminal,
} from "./program-status.ts";

const ESC = "\u001b";
const ST = `${ESC}\\`;

function osc26Fields(sequence: string): Map<string, string> {
  assert.ok(sequence.startsWith(`${ESC}]26;`));
  assert.ok(sequence.endsWith(ST));
  return new Map(
    sequence.slice(`${ESC}]26;`.length, -ST.length).split(";").map((pair) => {
      const at = pair.indexOf("=");
      return [pair.slice(0, at), pair.slice(at + 1)];
    }),
  );
}

function osc9999Payload(sequence: string): unknown {
  assert.ok(sequence.startsWith(`${ESC}]9999;`));
  assert.ok(sequence.endsWith(ST));
  return JSON.parse(sequence.slice(`${ESC}]9999;`.length, -ST.length));
}

test("OSC 26 maps Max lifecycle state and base64-encodes display fields", () => {
  const fields = osc26Fields(formatOsc26({ state: "working", message: `thinking${ESC}]52;c;bad\u0007` }, "/work/über max"));
  assert.equal(fields.get("CodeAgent"), "max");
  assert.equal(fields.get("Version"), "1");
  assert.equal(fields.get("Status"), "running");
  assert.equal(Buffer.from(fields.get("ProjectFolder") ?? "", "base64").toString("utf8"), "/work/über max");
  assert.equal(Buffer.from(fields.get("Detail") ?? "", "base64").toString("utf8"), "thinking ]52;c;bad ");

  assert.equal(osc26Fields(formatOsc26({ state: "blocked", kind: "permission" }, "/work")).get("Status"), "awaiting-approval");
  assert.equal(osc26Fields(formatOsc26({ state: "blocked", kind: "question" }, "/work")).get("Status"), "awaiting-input");
  assert.equal(osc26Fields(formatOsc26({ state: "clear" }, "/work")).get("Status"), "finished");
});

test("OSC 9999 emits the Orca-compatible minimal JSON payload", () => {
  const cases: Array<[MaxProgramStatus, string]> = [
    [{ state: "idle" }, "waiting"],
    [{ state: "working" }, "working"],
    [{ state: "blocked", kind: "question" }, "blocked"],
    [{ state: "done" }, "done"],
    [{ state: "error" }, "done"],
    [{ state: "clear" }, "done"],
  ];
  for (const [status, state] of cases) {
    assert.deepEqual(osc9999Payload(formatOsc9999(status)), { agentType: "max", state, prompt: "" });
  }
});

test("reporter emits trusted OSC 7501, 26, and 9999 state together", () => {
  const statuses: ProgramStatus[] = [];
  const progress: boolean[] = [];
  const writes: string[] = [];
  const terminal: ProgramStatusTerminal = {
    setProgramStatus: (status) => statuses.push(status),
    setProgress: (active) => progress.push(active),
    write: (data) => writes.push(data),
  };
  const reporter = new MaxProgramStatusReporter(terminal, "/work");
  reporter.report({ state: "blocked", kind: "auth", message: "Sign in" });

  assert.deepEqual(statuses, [{ state: "blocked", app: "max", kind: "auth", message: "Sign in" }]);
  assert.deepEqual(progress, [false]);
  assert.equal(osc26Fields(writes[0] ?? "").get("Status"), "awaiting-approval");
  assert.deepEqual(osc9999Payload(writes[1] ?? ""), { agentType: "max", state: "blocked", prompt: "" });

  reporter.report({ state: "working" });
  assert.deepEqual(progress, [false, true]);
});
