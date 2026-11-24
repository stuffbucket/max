export type Command =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "init" }
  | { kind: "doctor" }
  | { kind: "models" }
  | { kind: "browse"; url: string }
  | { kind: "print"; prompt: string }
  | { kind: "interactive" };

export function parseArgs(args: readonly string[]): Command {
  if (args.length === 0) return { kind: "interactive" };
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) return { kind: "help" };
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) return { kind: "version" };
  if (args.length === 1 && args[0] === "init") return { kind: "init" };
  if (args.length === 1 && args[0] === "doctor") return { kind: "doctor" };
  if (args.length === 1 && args[0] === "models") return { kind: "models" };
  if (args[0] === "browse") {
    if (args.length !== 2 || args[1]?.trim() === "") throw new Error("browse requires one absolute URL");
    return { kind: "browse", url: args[1] };
  }
  if (args[0] === "--print" || args[0] === "-p") {
    const prompt = args.slice(1).join(" ").trim();
    if (prompt === "") throw new Error(`${args[0]} requires a prompt`);
    return { kind: "print", prompt };
  }
  throw new Error(`unknown command or option: ${args[0]}`);
}
