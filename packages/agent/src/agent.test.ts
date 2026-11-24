import assert from "node:assert/strict";
import test from "node:test";
import { Agent, IncompleteCompletionError } from "./agent.ts";
import type { Completion, CompletionRequest, ModelClient } from "./domain.ts";

class ScriptedClient implements ModelClient {
  readonly requests: CompletionRequest[] = [];
  #replies: Completion[];

  constructor(replies: Completion[]) {
    this.#replies = replies;
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    this.requests.push(request);
    const completion = this.#replies.shift();
    if (completion === undefined) throw new Error("no scripted reply");
    return completion;
  }
}

test("agent commits history only after a successful completion", async () => {
  const client = new ScriptedClient([{ text: "one", stopReason: "end_turn" }]);
  const agent = new Agent({ client, model: "model", system: "system" });
  assert.equal(await agent.prompt(" first "), "one");
  assert.deepEqual(agent.messages, [
    { role: "user", content: "first" },
    { role: "assistant", content: "one" },
  ]);
  await assert.rejects(() => agent.prompt("second"), /no scripted reply/);
  assert.equal(agent.messages.length, 2);
});

test("agent rejects empty prompts and can reset", async () => {
  const agent = new Agent({ client: new ScriptedClient([{ text: "ok", stopReason: "end_turn" }]), model: "model" });
  await assert.rejects(() => agent.prompt("  "), /must not be empty/);
  await agent.prompt("go");
  agent.reset();
  assert.deepEqual(agent.messages, []);
});

test("agent rejects and does not commit incomplete model turns", async () => {
  for (const stopReason of ["max_tokens", "pause_turn", "tool_use"]) {
    const agent = new Agent({ client: new ScriptedClient([{ text: "partial", stopReason }]), model: "model" });
    await assert.rejects(
      () => agent.prompt("go"),
      (error: unknown) =>
        error instanceof IncompleteCompletionError && error.stopReason === stopReason && error.partialText === "partial",
    );
    assert.deepEqual(agent.messages, []);
  }
});

test("agent rejects concurrent prompts and reset while a turn is active", async () => {
  let finish: ((completion: Completion) => void) | undefined;
  const client: ModelClient = {
    complete: () => new Promise<Completion>((resolve) => {
      finish = resolve;
    }),
  };
  const agent = new Agent({ client, model: "model" });
  const first = agent.prompt("one");
  await assert.rejects(() => agent.prompt("two"), /already in progress/);
  assert.throws(() => agent.reset(), /prompt is in progress/);
  if (finish === undefined) throw new Error("client was not called");
  finish({ text: "done", stopReason: "end_turn" });
  assert.equal(await first, "done");
  assert.deepEqual(agent.messages, [
    { role: "user", content: "one" },
    { role: "assistant", content: "done" },
  ]);
});
