import type { Message, ModelClient } from "./domain.js";

export interface AgentOptions {
  client: ModelClient;
  model: string;
  system?: string;
  maxTokens?: number;
}

const TERMINAL_STOP_REASONS = new Set(["end_turn", "stop_sequence", "refusal"]);

export class IncompleteCompletionError extends Error {
  readonly stopReason: string;
  readonly partialText: string;

  constructor(stopReason: string, partialText: string) {
    super(`model stopped before completing the response (${stopReason})`);
    this.name = "IncompleteCompletionError";
    this.stopReason = stopReason;
    this.partialText = partialText;
  }
}

export class Agent {
  readonly #client: ModelClient;
  readonly #model: string;
  readonly #system?: string;
  readonly #maxTokens?: number;
  #messages: Message[] = [];
  #inFlight = false;

  constructor(options: AgentOptions) {
    this.#client = options.client;
    this.#model = options.model;
    this.#system = options.system;
    this.#maxTokens = options.maxTokens;
  }

  get messages(): readonly Message[] {
    return this.#messages;
  }

  async prompt(text: string, signal?: AbortSignal): Promise<string> {
    const content = text.trim();
    if (content === "") throw new Error("prompt must not be empty");
    if (this.#inFlight) throw new Error("another prompt is already in progress");
    this.#inFlight = true;
    try {
      const pending: Message[] = [...this.#messages, { role: "user", content }];
      const completion = await this.#client.complete(
        {
          model: this.#model,
          messages: pending,
          ...(this.#system === undefined ? {} : { system: this.#system }),
          ...(this.#maxTokens === undefined ? {} : { maxTokens: this.#maxTokens }),
        },
        signal,
      );
      if (!TERMINAL_STOP_REASONS.has(completion.stopReason)) {
        throw new IncompleteCompletionError(completion.stopReason, completion.text);
      }
      this.#messages = [...pending, { role: "assistant", content: completion.text }];
      return completion.text;
    } finally {
      this.#inFlight = false;
    }
  }

  reset(): void {
    if (this.#inFlight) throw new Error("cannot reset while a prompt is in progress");
    this.#messages = [];
  }
}
