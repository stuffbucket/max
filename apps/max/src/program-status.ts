import type { ProgramStatus } from "@earendil-works/pi-tui";

const ESC = "\u001b";
const ST = `${ESC}\\`;

export type MaxProgramState = "idle" | "working" | "blocked" | "done" | "error" | "clear";
export type MaxBlockedKind = "permission" | "question" | "auth";

export interface MaxProgramStatus {
  state: MaxProgramState;
  kind?: MaxBlockedKind;
  message?: string;
}

export interface ProgramStatusTerminal {
  write(data: string): void;
  setProgramStatus(status: ProgramStatus): void;
  setProgress(active: boolean): void;
}

function cleanDisplayText(value: string, limit: number): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, limit);
}

function base64(value: string, limit: number): string {
  return Buffer.from(cleanDisplayText(value, limit), "utf8").toString("base64");
}

function osc26State(status: MaxProgramStatus): string {
  switch (status.state) {
    case "idle":
      return "idle";
    case "working":
      return "running";
    case "blocked":
      return status.kind === "question" ? "awaiting-input" : "awaiting-approval";
    case "done":
      return "idle";
    case "error":
      return "error";
    case "clear":
      return "finished";
  }
}

function osc9999State(status: MaxProgramStatus): string {
  switch (status.state) {
    case "idle":
      return "waiting";
    case "working":
      return "working";
    case "blocked":
      return "blocked";
    case "done":
    case "error":
    case "clear":
      return "done";
  }
}

export function formatOsc26(status: MaxProgramStatus, projectFolder: string): string {
  const pairs = [
    "CodeAgent=max",
    "Version=1",
    `Status=${osc26State(status)}`,
    `ProjectFolder=${base64(projectFolder, 4096)}`,
  ];
  if (status.message !== undefined && status.message !== "") pairs.push(`Detail=${base64(status.message, 2048)}`);
  return `${ESC}]26;${pairs.join(";")}${ST}`;
}

export function formatOsc9999(status: MaxProgramStatus): string {
  const payload = { agentType: "max", state: osc9999State(status), prompt: "" };
  return `${ESC}]9999;${JSON.stringify(payload)}${ST}`;
}

function formatOsc7501(status: MaxProgramStatus): ProgramStatus {
  return {
    state: status.state,
    app: "max",
    ...(status.state === "blocked" && status.kind !== undefined ? { kind: status.kind } : {}),
    ...(status.message === undefined ? {} : { message: cleanDisplayText(status.message, 2048) }),
  };
}

/** Emits trusted Max lifecycle state through the three agent-status protocols used by current terminals. */
export class MaxProgramStatusReporter {
  readonly #terminal: ProgramStatusTerminal;
  readonly #projectFolder: string;

  constructor(terminal: ProgramStatusTerminal, projectFolder = process.cwd()) {
    this.#terminal = terminal;
    this.#projectFolder = projectFolder;
  }

  report(status: MaxProgramStatus): void {
    this.#terminal.setProgramStatus(formatOsc7501(status));
    this.#terminal.setProgress(status.state === "working");
    this.#terminal.write(formatOsc26(status, this.#projectFolder));
    this.#terminal.write(formatOsc9999(status));
  }
}
