# 0001: Max owns its runtime

**Status:** accepted

## Context

Pi's ready-made coding agent and agent core depend directly on `pi-ai`. That brings provider SDKs, generated model catalogs, provider-specific compatibility logic, and product identity that Max does not need. Wrapping that stack would preserve the coupling this repository exists to remove.

Pi's TUI package is independent: it does not depend on `pi-ai` or the Pi agent core.

## Decision

Max will:

- use `@earendil-works/pi-tui` for terminal rendering and input;
- own its model-client interface and Maximal gateway implementation;
- own conversation state, tool execution, persistence, configuration, and extension loading;
- reject `pi-ai`, `pi-agent-core`, and `pi-coding-agent` in automated checks.

## Consequences

Max does not inherit Pi's coding-agent features for free. Tools, streaming, sessions, permissions, packages, and extensions must be implemented deliberately. The benefit is one product identity and one protocol boundary, without hidden provider catalogs or another harness's state conventions.
