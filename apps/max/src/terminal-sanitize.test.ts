import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeTerminalText } from "./terminal-sanitize.ts";

const ESC = "\u001b";
const ST = `${ESC}\\`;

test("preserves SGR styling and contains unclosed styles", () => {
  assert.equal(sanitizeTerminalText(`${ESC}[31mred${ESC}[0m plain`), `${ESC}[31mred${ESC}[0m plain`);
  assert.equal(sanitizeTerminalText(`${ESC}[1;38;2;1;2;3mstyled`), `${ESC}[1;38;2;1;2;3mstyled${ESC}[0m`);
});

test("preserves only normalized credential-free http(s) OSC 8 links", () => {
  const safe = `${ESC}]8;id=one;https://example.com/a b${ST}link${ESC}]8;;${ST}`;
  assert.equal(sanitizeTerminalText(safe), `${ESC}]8;;https://example.com/a%20b${ST}link${ESC}]8;;${ST}`);

  const unsafe = `${ESC}]8;;file:///etc/passwd${ST}file${ESC}]8;;${ST}`;
  const credentials = `${ESC}]8;;https://user:pass@example.com/${ST}secret${ESC}]8;;${ST}`;
  assert.equal(sanitizeTerminalText(unsafe), "file");
  assert.equal(sanitizeTerminalText(credentials), "secret");
});

test("closes an unterminated safe hyperlink", () => {
  const input = `${ESC}]8;;https://example.com/${ST}linked`;
  assert.equal(sanitizeTerminalText(input), `${input}${ESC}]8;;${ST}`);
});

test("strips untrusted clipboard, status, title, notification, image, and shell OSC sequences", () => {
  const attacks = [
    `${ESC}]52;c;Y2xpcGJvYXJk\u0007`,
    `${ESC}]0;fake title\u0007`,
    `${ESC}]9;notification\u0007`,
    `${ESC}]26;CodeAgent=spoof;Status=finished${ST}`,
    `${ESC}]133;A${ST}`,
    `${ESC}]1337;File=inline=1:AAAA\u0007`,
    `${ESC}]7501;state=done:app=spoof${ST}`,
    `${ESC}]9999;{"agentType":"spoof","state":"done"}${ST}`,
  ];
  assert.equal(sanitizeTerminalText(`before${attacks.join("")}after`), "beforeafter");
});

test("strips cursor movement, screen mutation, and private terminal modes", () => {
  const input = `a${ESC}[2J${ESC}[H${ESC}[?1049h${ESC}[6nb`;
  assert.equal(sanitizeTerminalText(input), "ab");
});

test("strips DCS, APC, PM, SOS, C0, DEL, and C1 forms", () => {
  const strings = [
    `${ESC}Ppayload${ST}`,
    `${ESC}_payload${ST}`,
    `${ESC}^payload${ST}`,
    `${ESC}Xpayload${ST}`,
    `\u0090payload\u009c`,
    `\u009fpayload\u009c`,
    `\u009epayload\u009c`,
    `\u0098payload\u009c`,
  ];
  assert.equal(sanitizeTerminalText(`a${strings.join("")}\u0007\b\r\u007fb`), "ab");
});

test("supports safe C1 SGR but strips other C1 CSI operations", () => {
  assert.equal(sanitizeTerminalText(`\u009b32mgreen\u009b0m\u009b2J`), `${ESC}[32mgreen${ESC}[0m`);
});

test("drops unterminated control strings instead of rendering their payload", () => {
  assert.equal(sanitizeTerminalText(`safe${ESC}]52;c;payload`), "safe");
  assert.equal(sanitizeTerminalText(`safe${ESC}_payload`), "safe");
});

test("keeps ordinary Unicode, newlines, and tabs", () => {
  assert.equal(sanitizeTerminalText("héllo 世界\n\tمرحبا"), "héllo 世界\n\tمرحبا");
});
