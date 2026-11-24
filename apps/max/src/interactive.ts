import {
  Editor,
  type EditorTheme,
  matchesKey,
  ProcessTerminal,
  Text,
  TuiMainScreen,
  type TUI,
} from "@earendil-works/pi-tui";
import type { Agent } from "@stuffbucket/max-agent";
import type { MaxConfig } from "./config.js";
import { MaxProgramStatusReporter } from "./program-status.js";
import { sanitizeTerminalText } from "./terminal-sanitize.js";

const plain = (text: string): string => text;
const theme: EditorTheme = {
  borderColor: plain,
  selectList: {
    selectedPrefix: plain,
    selectedText: plain,
    description: plain,
    scrollInfo: plain,
    noMatch: plain,
  },
};

export async function runInteractive(agent: Agent, config: MaxConfig): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("interactive mode requires a TTY; use max -p <prompt>");

  const terminal = new ProcessTerminal();
  const status = new MaxProgramStatusReporter(terminal);
  const tui: TUI = new TuiMainScreen(terminal);
  const editor = new Editor(tui, theme, { paddingX: 1 });
  let stopped = false;
  let activeTurn: AbortController | undefined;

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    activeTurn?.abort();
    activeTurn = undefined;
    status.report({ state: "clear" });
    terminal.setTitle("");
    tui.stop();
  };

  tui.addChild(new Text(sanitizeTerminalText(`Max · ${config.model}\n${config.gateway}`), 1, 1));
  tui.addChild(editor);
  const appendTurn = (label: string, text: string): void => {
    tui.removeChild(editor);
    tui.addChild(new Text(`\n${sanitizeTerminalText(label)}\n${sanitizeTerminalText(text)}`, 1, 0));
    tui.addChild(editor);
  };
  tui.setFocus(editor);
  tui.addInputListener((data) => {
    if (!matchesKey(data, "ctrl+c")) return undefined;
    stop();
    return { consume: true };
  });

  editor.onSubmit = (input) => {
    const prompt = input.trim();
    if (prompt === "" || editor.disableSubmit) return;
    editor.addToHistory(prompt);
    editor.setText("");
    editor.disableSubmit = true;
    appendTurn("You", prompt);
    tui.requestRender();
    const turn = new AbortController();
    activeTurn = turn;
    status.report({ state: "working" });
    void agent.prompt(prompt, turn.signal).then(
      (reply) => {
        if (stopped) return;
        appendTurn("Max", reply);
        status.report({ state: "done" });
      },
      (error: unknown) => {
        if (stopped) return;
        const message = error instanceof Error ? error.message : String(error);
        appendTurn("Error", message);
        status.report({ state: "error", message });
      },
    ).finally(() => {
      if (activeTurn === turn) activeTurn = undefined;
      if (stopped) return;
      editor.disableSubmit = false;
      tui.setFocus(editor);
      tui.requestRender();
    });
  };

  tui.start();
  void tui.queryTerminalColors({ timeoutMs: 200 }).catch(() => undefined);
  terminal.setTitle(`Max · ${config.model}`);
  status.report({ state: "idle" });
  await new Promise<void>((resolve) => {
    const poll = setInterval(() => {
      if (!stopped) return;
      clearInterval(poll);
      resolve();
    }, 25);
  });
}
