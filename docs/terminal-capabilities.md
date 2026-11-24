# Terminal capabilities

Max separates trusted terminal operations from model output. A model may produce styled text and safe HTTP(S) hyperlinks, but it cannot write clipboard, title, status, notification, image, shell-integration, or input-control sequences. Those capabilities are exposed through typed Max-owned APIs.

## Supported trusted capabilities

| Protocol | Max support |
|---|---|
| OSC 0 / OSC 2 | Sanitized icon+window or window-only title encoding. Chat uses OSC 0; browser mode uses OSC 2. |
| OSC 4 / 10 / 11 | Pi TUI queries ANSI palette, foreground, and background after interactive startup. Max also exposes query encoding. |
| OSC 8 | Model links survive only when they normalize to credential-free HTTP(S). |
| OSC 9;4 | Agent working state drives trusted indeterminate progress and clear operations. |
| OSC 26 / 7501 / 9999 | Trusted agent lifecycle reporting. Model-provided copies are stripped. |
| OSC 52 | Bounded trusted clipboard writes. Fullscreen browser selection copies selected page text on mouse release. |
| Kitty graphics | Static PNG placement, stable-id live browser frames, and native frame/control/query/delete animation encoders. |
| OSC 9 / 99 / 777 | Sanitized trusted notification encoders. Max does not currently send unsolicited notifications. |

## Clipboard and selection

Ordinary main-screen mouse selection belongs to the terminal emulator; its copy-on-select preference does not require OSC 52. Fullscreen applications capture the mouse themselves. In fullscreen browser mode, Max maps the drag to Chromium, reads Chromium's selected text, and then emits a bounded OSC 52 clipboard write. Ctrl+C copies the current browser selection, or is forwarded to the page when there is no selection.

## Browser and Kitty graphics

`max browse <url>` launches a system Chrome, Chromium, or Edge through `playwright-core`. The browser is headless, but it is interactive: fullscreen terminal mouse and keyboard events are forwarded to the page. Max captures PNG frames at 10 fps and replaces one stable Kitty image id, which displays page and CSS animations without placement flicker.

`packages/terminal` also implements Kitty's native animation primitives:

- frame data transfer (`a=f`), including chunking, delay, composition base, edits, and replace blending;
- animation control (`a=a`) for stop, loading, looping, frame selection, and frame delay changes;
- feature queries for frame, animation, and composition support;
- animation-frame deletion with optional data release.

Max uses inline data transfer. It does not expose Kitty file, temporary-file, shared-memory, or arbitrary path transfer to model output.

## Notifications

- **OSC 9** is a legacy single-message desktop notification. OSC 9;4 is a separate progress protocol.
- **OSC 99** is Kitty's structured notification protocol: ids, title/body chunks, updates, close events, icons, buttons, urgency, expiry, sounds, and optional click reports.
- **OSC 777** is the rxvt/VTE-style `notify;title;body` protocol.

Max has trusted encoders for the common text forms. No model text is passed into a notification without control stripping and size bounds, and Max currently sends no automatic desktop notifications.

## OSC 133 and OSC 1337

OSC 133 marks shell prompt and command boundaries. It is TUI-owned because forged prompt markers can corrupt navigation and clear program-status records.

OSC 1337 is an iTerm2 namespace, not one capability. It includes:

- inline files and images;
- user variables and variable reports;
- profile, color, Unicode-width, cursor-shape, key-label, and background-image changes;
- annotations, marks, code blocks, and custom buttons;
- clipboard capture and one-shot copy;
- scrollback and captured-output clearing;
- focus stealing, attention requests, URL opening, uploads, and custom sequences;
- cell-size, shell-integration, current-directory, and remote-host reports.

Because that namespace mixes rendering with destructive and data-returning operations, Max does not provide blanket OSC 1337 passthrough. Specific operations can be added as typed trusted APIs when a product feature needs them. Image rendering uses Kitty graphics or Pi TUI's existing trusted iTerm2 image encoder instead.

## Mouse and keyboard modes

Mouse support is CSI, not OSC. Fullscreen Pi TUI manages:

- `CSI ?1000` button tracking;
- `CSI ?1002` button-motion tracking;
- `CSI ?1003` all-motion tracking;
- `CSI ?1006` SGR mouse coordinates;
- `CSI ?1004` focus reporting.

Pi TUI also owns synchronized output (`CSI ?2026`), bracketed paste (`CSI ?2004`), Kitty keyboard negotiation, `modifyOtherKeys` fallback, cursor visibility, and terminal-mode restoration.

## Sources

- [Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/)
- [Kitty desktop notifications](https://sw.kovidgoyal.net/kitty/desktop-notifications/)
- [iTerm2 escape codes](https://iterm2.com/documentation-escape-codes.html)
- [OSC 26 Terminal Agent Protocol](https://docs.otty.sh/vt/osc/osc-26)
- [OSC 7501 Program Status](https://contour-terminal.org/vt-extensions/program-status/)
- [xterm control sequences](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html)
