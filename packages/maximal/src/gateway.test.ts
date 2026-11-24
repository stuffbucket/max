import assert from "node:assert/strict";
import test from "node:test";
import { MaximalGateway, type Fetch } from "./gateway.ts";

test("listModels exposes only models compatible with the Anthropic Messages transport", async () => {
  const fetch: Fetch = async (input, init) => {
    assert.equal(String(input), "http://gateway/v1/models");
    assert.equal(init?.method, undefined);
    assert.equal(new Headers(init?.headers).get("anthropic-version"), null);
    return Response.json({
      data: [
        { id: "claude-x", display_name: "Claude X", owned_by: "Anthropic" },
        { id: "gpt-x", display_name: "GPT X", owned_by: "OpenAI" },
        { id: "embedding-x", owned_by: "Azure OpenAI", max_tokens: 0 },
        { nope: true },
      ],
    });
  };
  const gateway = new MaximalGateway({ baseUrl: "http://gateway/", fetch });
  assert.deepEqual(await gateway.listModels(), [{ id: "claude-x", name: "Claude X" }]);
});

test("complete speaks the explicit Anthropic Messages boundary", async () => {
  const fetch: Fetch = async (input, init) => {
    assert.equal(String(input), "http://gateway/v1/messages");
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("anthropic-version"), "2023-06-01");
    assert.equal(headers.get("authorization"), "Bearer secret");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      model: "claude-x",
      max_tokens: 123,
      messages: [{ role: "user", content: "hello" }],
      system: "system",
    });
    return Response.json({ content: [{ type: "text", text: "hi" }], stop_reason: "end_turn" });
  };
  const gateway = new MaximalGateway({ baseUrl: "http://gateway", apiKey: "secret", fetch });
  assert.deepEqual(
    await gateway.complete({ model: "claude-x", maxTokens: 123, system: "system", messages: [{ role: "user", content: "hello" }] }),
    { text: "hi", stopReason: "end_turn" },
  );
});

test("complete rejects responses without a stop reason", async () => {
  const fetch: Fetch = async () => Response.json({ content: [{ type: "text", text: "partial" }] });
  const gateway = new MaximalGateway({ baseUrl: "http://gateway", fetch });
  await assert.rejects(() => gateway.complete({ model: "claude-x", messages: [{ role: "user", content: "hello" }] }), /no stop reason/);
});

test("gateway errors include bounded response detail", async () => {
  const fetch: Fetch = async () => new Response("broken", { status: 502, statusText: "Bad Gateway" });
  const gateway = new MaximalGateway({ baseUrl: "http://gateway", fetch });
  await assert.rejects(() => gateway.listModels(), /502 Bad Gateway: broken/);
});
