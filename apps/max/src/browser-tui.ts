import {
  allocateImageId,
  type Component,
  type Focusable,
  Image,
  parseKey,
  ProcessTerminal,
  Text,
  TuiAltScreen,
  type TUI,
  type TuiMouseEvent,
  type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { BrowserSession } from "@stuffbucket/max-browser";
import { formatClipboard, formatTitle } from "@stuffbucket/max-terminal";
import { MaxProgramStatusReporter } from "./program-status.js";
import { sanitizeTerminalText } from "./terminal-sanitize.js";

const plain = (text: string): string => text;
const KEY_NAMES: Readonly<Record<string, string>> = {
  escape: "Escape",
  esc: "Escape",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageUp: "PageUp",
  pageDown: "PageDown",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

function playwrightKey(key: string): string | undefined {
  const parts = key.split("+");
  const base = parts.pop();
  if (base === undefined) return undefined;
  const mapped = KEY_NAMES[base] ?? (/^f(?:[1-9]|1[0-2])$/i.test(base) ? base.toUpperCase() : base.length === 1 ? base : undefined);
  if (mapped === undefined) return undefined;
  const modifiers = parts.map((part) => ({ ctrl: "Control", alt: "Alt", shift: "Shift", super: "Meta" })[part]).filter((part): part is string => part !== undefined);
  return [...modifiers, mapped].join("+");
}

class BrowserSurface implements Component, Focusable {
  focused = false;
  readonly capturesViewportInput = true;
  readonly #browser: BrowserSession;
  readonly #tui: TUI;
  readonly #terminal: ProcessTerminal;
  readonly #imageId = allocateImageId();
  #image: Image | undefined;
  #maxHeightCells: number;

  constructor(browser: BrowserSession, tui: TUI, terminal: ProcessTerminal, maxHeightCells: number) {
    this.#browser = browser;
    this.#tui = tui;
    this.#terminal = terminal;
    this.#maxHeightCells = maxHeightCells;
  }

  setMaxHeightCells(value: number): void {
    this.#maxHeightCells = Math.max(1, value);
  }

  setFrame(base64: string, width: number, height: number): void {
    this.#image = new Image(base64, "image/png", { fallbackColor: plain }, {
      imageId: this.#imageId,
      maxHeightCells: this.#maxHeightCells,
      maxWidthCells: this.#terminal.columns,
    }, { widthPx: width, heightPx: height });
    this.#tui.requestRender();
  }

  invalidate(): void {
    this.#image?.invalidate();
  }

  render(width: number): string[] {
    return this.#image?.render(width) ?? ["Loading browser frame…"];
  }

  handleInput(data: string): void {
    const key = parseKey(data);
    if (key === "ctrl+c") {
      void this.#browser.selectionText().then((text) => {
        if (text !== "") this.#terminal.write(formatClipboard(text));
        else return this.#browser.press("Control+C");
      });
      return;
    }
    if (key !== undefined) {
      const mapped = playwrightKey(key);
      if (mapped !== undefined) void this.#browser.press(mapped);
      return;
    }
    if (!data.includes("\u001b") && [...data].every((char) => char >= " ")) void this.#browser.insertText(data);
  }

  handleMouse(event: TuiMouseEvent): TuiMouseEventResult {
    const viewport = this.#browser.viewport;
    const x = Math.max(0, Math.min(viewport.width - 1, Math.floor(((event.x + 0.5) / Math.max(1, event.width)) * viewport.width)));
    const y = Math.max(0, Math.min(viewport.height - 1, Math.floor(((event.y + 0.5) / Math.max(1, event.height)) * viewport.height)));
    const button = event.button === "none" ? "left" : event.button;
    if (event.type === "wheel") {
      void this.#browser.mouseWheel((event.wheelDelta ?? 0) * 80);
      return { handled: true, focus: true };
    }
    if (event.type === "press") {
      void this.#browser.mouseMove(x, y).then(() => this.#browser.mouseDown(button));
      return { handled: true, capture: true, focus: true };
    }
    if (event.type === "move" || event.type === "drag") {
      void this.#browser.mouseMove(x, y);
      return { handled: true, capture: event.type === "drag", focus: true, render: false };
    }
    if (event.type === "release") {
      void this.#browser.mouseMove(x, y).then(() => this.#browser.mouseUp(button)).then(() => this.#browser.selectionText()).then((text) => {
        if (text !== "") this.#terminal.write(formatClipboard(text));
      });
      return { handled: true, focus: true };
    }
    return { handled: true, focus: true };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBrowserTui(url: string): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("browser mode requires a TTY");
  const terminal = new ProcessTerminal();
  const browser = await BrowserSession.launch({ url, viewport: { width: 1280, height: 720 } });
  const status = new MaxProgramStatusReporter(terminal);
  const tui = new TuiAltScreen(terminal, undefined, undefined, { mouse: true, copyOnSelect: true });
  const header = new Text("Max Browser · loading", 1, 0);
  const surface = new BrowserSurface(browser, tui, terminal, Math.max(1, terminal.rows - 2));
  tui.addChild(header);
  tui.addChild(surface);
  tui.setFocus(surface);
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    status.report({ state: "clear" });
    terminal.write(formatTitle("", "window"));
    tui.stop();
  };
  tui.addInputListener((data) => {
    if (parseKey(data) !== "ctrl+q") return undefined;
    stop();
    return { consume: true };
  });
  tui.start();
  status.report({ state: "working", message: "Launching browser" });
  void tui.queryTerminalColors({ timeoutMs: 200 }).catch(() => undefined);
  const title = await browser.title();
  header.setText(sanitizeTerminalText(`Max Browser · ${title || browser.url()} · Ctrl+Q exits`));
  terminal.write(formatTitle(`Max Browser · ${title || browser.url()}`, "window"));
  status.report({ state: "done" });

  try {
    while (!stopped) {
      surface.setMaxHeightCells(Math.max(1, terminal.rows - 2));
      const frame = await browser.screenshot();
      surface.setFrame(frame.base64, frame.width, frame.height);
      await delay(100);
    }
  } finally {
    stop();
    await browser.close();
  }
}
