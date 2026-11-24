export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: readonly Message[];
  system?: string;
  maxTokens?: number;
}

export interface Completion {
  text: string;
  stopReason: string;
}

export interface ModelClient {
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<Completion>;
}
