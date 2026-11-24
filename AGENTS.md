# Max development

Max is a Maximal-native terminal coding agent in a Turbo monorepo managed by mise and pnpm.

## Workspace

- `apps/max`: CLI, configuration, and interactive TUI.
- `packages/agent`: Max-owned conversation loop and model contracts.
- `packages/browser`: Chromium session and browser input, independent of the TUI.
- `packages/maximal`: validated Maximal gateway client.
- `packages/terminal`: trusted terminal protocol encoders, independent of models and UI.
- Keep dependencies pointing inward: app → browser/terminal/Maximal client → agent contracts. The agent package knows nothing about HTTP or the TUI.

## Boundaries

- `@earendil-works/pi-tui` is the only allowed Pi runtime dependency.
- Do not add `pi-ai`, `pi-agent-core`, or `pi-coding-agent`. `pnpm check` enforces this across every manifest and the lockfile.
- Model-family compatibility belongs behind `ModelClient`, never in the agent loop or UI.
- Validate files, environment values, HTTP responses, and tool inputs at their boundaries. Keep internal types strict.
- Max owns its state format, configuration, tools, permissions, sessions, extensions, and product identity.
- Treat model text, gateway metadata, and remote error bodies as terminal-untrusted. Route them through the selective sanitizer; preserve only explicitly reviewed display capabilities. Agent-state OSC sequences are emitted only by Max's trusted lifecycle reporter, never passed through from model text.
- Keep `.npmrc`, `.pnpmfile.cjs`, `apply-pnpm-tarball-policy.mjs`, the root policy, and `pnpm-workspace.yaml` aligned. Installs must resolve through the configured proxy.

## Changes

- Use one branch and worktree per task after the repository has an initial commit.
- Run `mise install --locked`, `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm build` before handing back.
- Do not claim interactive behavior was verified unless it was exercised in a real TTY.
- Do not commit or push unless the user asks.
