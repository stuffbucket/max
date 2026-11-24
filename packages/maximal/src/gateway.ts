import type { Completion, CompletionRequest, Message, ModelClient } from "@stuffbucket/max-agent";

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface GatewayOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: Fetch;
}

export interface GatewayModel {
  id: string;
  name?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseModels(value: unknown): GatewayModel[] {
  if (!isRecord(value) || !Array.isArray(value.data)) throw new Error("gateway returned an invalid model catalog");
  const models: GatewayModel[] = [];
  for (const entry of value.data) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.owned_by !== "string") continue;
    if (entry.owned_by.toLowerCase() !== "anthropic") continue;
    const name = typeof entry.display_name === "string" ? entry.display_name : typeof entry.name === "string" ? entry.name : undefined;
    models.push({ id: entry.id, ...(name === undefined ? {} : { name }) });
  }
  return models;
}

function parseCompletion(value: unknown): Completion {
  if (!isRecord(value) || !Array.isArray(value.content)) throw new Error("gateway returned an invalid completion");
  const text = value.content
    .filter((block): block is Record<string, unknown> => isRecord(block))
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
  if (text === "") throw new Error("gateway completion contained no text");
  if (typeof value.stop_reason !== "string") throw new Error("gateway completion contained no stop reason");
  return { text, stopReason: value.stop_reason };
}

async function responseError(response: Response): Promise<Error> {
  let detail = "";
  try {
    detail = (await response.text()).trim().slice(0, 500);
  } catch {
    // The status is still useful when the body cannot be read.
  }
  return new Error(`gateway request failed: ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
}

function requestMessages(messages: readonly Message[]): Array<{ role: Message["role"]; content: string }> {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export class MaximalGateway implements ModelClient {
  readonly #baseUrl: string;
  readonly #apiKey?: string;
  readonly #fetch: Fetch;

  constructor(options: GatewayOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  #headers(extra: HeadersInit = {}): Headers {
    const headers = new Headers(extra);
    if (this.#apiKey !== undefined) headers.set("authorization", `Bearer ${this.#apiKey}`);
    return headers;
  }

  async listModels(signal?: AbortSignal): Promise<GatewayModel[]> {
    const response = await this.#fetch(`${this.#baseUrl}/v1/models`, {
      headers: this.#headers(),
      signal,
    });
    if (!response.ok) throw await responseError(response);
    const value: unknown = await response.json();
    return parseModels(value);
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<Completion> {
    const body = {
      model: request.model,
      max_tokens: request.maxTokens ?? 8192,
      messages: requestMessages(request.messages),
      ...(request.system === undefined ? {} : { system: request.system }),
    };
    const response = await this.#fetch(`${this.#baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.#headers({ "anthropic-version": "2023-06-01", "content-type": "application/json" }),
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw await responseError(response);
    const value: unknown = await response.json();
    return parseCompletion(value);
  }
}
