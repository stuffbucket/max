# Max

Max is a terminal coding agent for the [Maximal](https://github.com/stuffbucket) model gateway.

This repository starts at a clean boundary. Max uses Pi's independent terminal UI package, but owns its model protocol, agent loop, tools, state, and product identity. It does **not** depend on `pi-ai`, `pi-agent-core`, or `pi-coding-agent`.

## Workspace

Max is a Turbo monorepo managed by mise and pnpm.

| Path | Responsibility |
|---|---|
| `apps/max/` | CLI, configuration, and interactive TUI |
| `packages/agent/` | Max-owned conversation loop and model contracts |
| `packages/browser/` | Interactive Chromium session and browser input |
| `packages/maximal/` | Validated Maximal gateway client |
| `packages/terminal/` | Trusted OSC, clipboard, notification, color, and Kitty encoders |

Every package install goes through `https://packagefeedproxy.microsoft.io/npm/` via the repository `.npmrc`. The checked-in hook from [`stuffbucket/pnpm-hooks`](https://github.com/stuffbucket/pnpm-hooks) prevents rotating proxy shard URLs from entering `pnpm-lock.yaml`; `pnpm check` verifies both the registry and lockfile policy.

## Status

The first vertical slice provides:

- `max init` for isolated state under `~/.local/state/max`
- `max doctor` and `max models` against a Maximal gateway
- `max -p "prompt"` through the Anthropic Messages endpoint
- `max browse <url>` with interactive Chromium frames, mouse, keyboard, Kitty graphics, and copy-on-selection
- an interactive terminal conversation built on `@earendil-works/pi-tui`
- strict configuration and gateway response validation
- selective terminal sanitization that preserves SGR styling and safe OSC 8 links
- trusted agent-state reporting through OSC 7501, OSC 26, OSC 9999, and OSC 9;4 progress
- an enforced dependency boundary around Pi's model and agent packages

This is not yet a coding agent: tools, streaming, session persistence, model-protocol negotiation, and extension loading are the next milestones.

## Development

Requires Node 26 or newer. mise pins Node through `.nvmrc` and pnpm through `mise.toml`.

```sh
mise trust
mise install --locked
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm max doctor
pnpm max models
pnpm max -p "Say hello in one sentence"
pnpm max browse https://example.com
```

To expose the development CLI as `max` for the active mise Node version:

```sh
pnpm build
cd apps/max
npm link
```

Maximal defaults to `http://localhost:4141`. Configuration precedence is environment, `<state>/config.json`, then defaults.

| Setting | Purpose |
|---|---|
| `MAX_STATE_DIR` | State directory; must be absolute |
| `XDG_STATE_HOME` | Parent of the default `max/` state directory |
| `MAX_GATEWAY_URL` | Maximal gateway URL |
| `MAX_MODEL` | Gateway model id |
| `MAX_API_KEY` | Optional gateway bearer token |
| `MAX_BROWSER_EXECUTABLE` | Optional path to Chrome, Chromium, or Edge |

`max init` creates this file without overwriting an existing one:

```json
{
  "gateway": "http://localhost:4141",
  "model": "claude-sonnet-5-5-20260301"
}
```

## Architecture

See [docs/architecture.md](docs/architecture.md), [terminal capabilities](docs/terminal-capabilities.md), and [decision 0001](docs/decisions/0001-max-native-runtime.md).

## License

MIT. Pi TUI remains under its own MIT license and is consumed as a package dependency. The copied pnpm policy hook is MIT licensed; see `scripts/pnpm-hooks-LICENSE`.
