import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";

export interface BrowserViewport {
  width: number;
  height: number;
}

export interface BrowserSessionOptions {
  url: string;
  viewport: BrowserViewport;
  executablePath?: string;
  env?: Readonly<Record<string, string | undefined>>;
}

const MACOS_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const LINUX_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];

function executableInPath(name: string, path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  for (const directory of path.split(delimiter)) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function resolveBrowserExecutable(
  env: Readonly<Record<string, string | undefined>> = process.env,
  platform = process.platform,
): string {
  if (env.MAX_BROWSER_EXECUTABLE !== undefined) {
    if (!existsSync(env.MAX_BROWSER_EXECUTABLE)) throw new Error(`MAX_BROWSER_EXECUTABLE does not exist: ${env.MAX_BROWSER_EXECUTABLE}`);
    return env.MAX_BROWSER_EXECUTABLE;
  }
  if (platform === "darwin") {
    const found = MACOS_CANDIDATES.find((candidate) => existsSync(candidate));
    if (found !== undefined) return found;
  }
  if (platform === "linux") {
    for (const name of LINUX_NAMES) {
      const found = executableInPath(name, env.PATH);
      if (found !== undefined) return found;
    }
  }
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter((value): value is string => value !== undefined);
    for (const root of roots) {
      for (const suffix of [
        "Google/Chrome/Application/chrome.exe",
        "Chromium/Application/chrome.exe",
        "Microsoft/Edge/Application/msedge.exe",
      ]) {
        const candidate = join(root, suffix);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error("no supported Chromium executable found; set MAX_BROWSER_EXECUTABLE");
}

export function normalizeBrowserUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`browser URL must be absolute: ${JSON.stringify(value)}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("browser URL must use http or https");
  return parsed.href;
}

function viewport(value: BrowserViewport): BrowserViewport {
  if (!Number.isInteger(value.width) || value.width < 320 || value.width > 3840) throw new Error("browser viewport width must be 320..3840");
  if (!Number.isInteger(value.height) || value.height < 200 || value.height > 2160) throw new Error("browser viewport height must be 200..2160");
  return value;
}

export class BrowserSession {
  readonly #browser: Browser;
  readonly #page: Page;
  #viewport: BrowserViewport;

  private constructor(browser: Browser, page: Page, initialViewport: BrowserViewport) {
    this.#browser = browser;
    this.#page = page;
    this.#viewport = initialViewport;
  }

  static async launch(options: BrowserSessionOptions): Promise<BrowserSession> {
    const initialViewport = viewport(options.viewport);
    const executablePath = options.executablePath ?? resolveBrowserExecutable(options.env);
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: initialViewport, deviceScaleFactor: 1 });
      await page.goto(normalizeBrowserUrl(options.url), { waitUntil: "domcontentloaded" });
      return new BrowserSession(browser, page, initialViewport);
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  get viewport(): BrowserViewport {
    return this.#viewport;
  }

  async setViewport(next: BrowserViewport): Promise<void> {
    const normalized = viewport(next);
    if (normalized.width === this.#viewport.width && normalized.height === this.#viewport.height) return;
    await this.#page.setViewportSize(normalized);
    this.#viewport = normalized;
  }

  async screenshot(): Promise<{ base64: string; width: number; height: number }> {
    const image = await this.#page.screenshot({ type: "png", animations: "allow" });
    return { base64: image.toString("base64"), width: this.#viewport.width, height: this.#viewport.height };
  }

  async mouseMove(x: number, y: number): Promise<void> {
    await this.#page.mouse.move(x, y);
  }

  async mouseDown(button: "left" | "middle" | "right" = "left"): Promise<void> {
    await this.#page.mouse.down({ button });
  }

  async mouseUp(button: "left" | "middle" | "right" = "left"): Promise<void> {
    await this.#page.mouse.up({ button });
  }

  async mouseWheel(deltaY: number): Promise<void> {
    await this.#page.mouse.wheel(0, deltaY);
  }

  async insertText(text: string): Promise<void> {
    await this.#page.keyboard.insertText(text);
  }

  async press(key: string): Promise<void> {
    await this.#page.keyboard.press(key);
  }

  async selectionText(): Promise<string> {
    return this.#page.evaluate(() => window.getSelection()?.toString() ?? "");
  }

  async title(): Promise<string> {
    return this.#page.title();
  }

  url(): string {
    return this.#page.url();
  }

  async close(): Promise<void> {
    await this.#browser.close();
  }
}
