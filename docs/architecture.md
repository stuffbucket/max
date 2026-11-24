# Architecture

Max is split at boundaries that can be tested without a terminal or model call.

```text
CLI / TUI
   |
 Agent                owns conversation state and turn semantics
   |
 ModelClient           Max-owned interface
   |
 MaximalGateway        validates Maximal HTTP requests and responses
   |
 Maximal
```

The layers are separate workspace packages: `apps/max` owns the CLI and TUI, `packages/maximal` owns model HTTP, `packages/agent` owns the model-independent loop and contracts, `packages/browser` owns Chromium, and `packages/terminal` owns trusted terminal protocol encoding.

## Dependency boundary

`@earendil-works/pi-tui` is the only Pi runtime dependency. It has no dependency on Pi's model or agent packages. `scripts/check.mjs` fails if `pi-ai`, `pi-agent-core`, or `pi-coding-agent` enters any workspace manifest or the lockfile.

## Protocol boundary

The initial `MaximalGateway` implements model discovery through `GET /v1/models` and Claude-family turns through `POST /v1/messages`. This limitation is explicit. Supporting other model families must happen behind the `ModelClient` interface or through a normalized Maximal endpoint; model-family heuristics do not belong in the agent loop.

## Terminal output boundary

Model responses, gateway metadata, and error bodies are untrusted terminal input. `apps/max/src/terminal-sanitize.ts` preserves display-only SGR styling and normalized credential-free `http:`/`https:` OSC 8 hyperlinks. It strips clipboard writes, terminal mutation, notifications, images, shell integration, cursor control, status spoofing, and other control strings before text reaches either the TUI or stdout/stderr. Preserved styles and hyperlinks are always closed so they cannot bleed into Max's own interface.

Trusted lifecycle state is separate from model output. `apps/max/src/program-status.ts` emits OSC 7501, OSC 26, OSC 9999, and OSC 9;4 progress from Max's own idle, working, blocked, done, error, and shutdown transitions. Model-provided copies of those sequences remain blocked.

## State boundary

Max resolves state in this order:

1. absolute `MAX_STATE_DIR`
2. absolute `$XDG_STATE_HOME/max`
3. `~/.local/state/max`

Configuration is strict. Unknown fields fail instead of being silently ignored, and environment values override the state file.

## Browser boundary

`packages/browser` runs a system Chrome, Chromium, or Edge through `playwright-core`; Max does not download a hidden browser binary. `apps/max/src/browser-tui.ts` captures PNG frames at 10 fps and reuses a stable Kitty image id, so CSS and page animations update without placement flicker. Fullscreen Pi TUI mouse and keyboard events are mapped to Chromium. Browser text selected by dragging is copied through Max's bounded, trusted OSC 52 encoder.

The native Kitty animation frame/control/query/delete encoders live in `packages/terminal`. Raw model text cannot access them.

## Next slices

1. Streaming response events and cancellation.
2. Session persistence with a versioned Max-owned format.
3. Typed tool calls and permission policy.
4. Read, write, edit, search, and shell tools.
5. A normalized Maximal protocol covering every served model family.
6. Trusted extension loading under `.max/` and the Max state directory.
