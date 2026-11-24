import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClipboard,
  formatColorQueries,
  formatOsc9Notification,
  formatOsc99Notification,
  formatOsc777Notification,
  formatTitle,
} from "./osc.ts";

const ESC = "\u001b";
const ST = `${ESC}\\`;

test("title formatters support OSC 0 and OSC 2 without control injection", () => {
  assert.equal(formatTitle(`Max${ESC}]52;c;bad\u0007`, "icon-and-window"), `${ESC}]0;Max ]52;c;bad ${ST}`);
  assert.equal(formatTitle("Browser", "window"), `${ESC}]2;Browser${ST}`);
});

test("clipboard formatter uses bounded OSC 52 base64 payloads", () => {
  assert.equal(formatClipboard("héllo"), `${ESC}]52;c;${Buffer.from("héllo").toString("base64")}${ST}`);
  assert.equal(formatClipboard("primary", "primary"), `${ESC}]52;p;${Buffer.from("primary").toString("base64")}${ST}`);
  assert.throws(() => formatClipboard("x".repeat(1024 * 1024 + 1)), /1 MiB/);
});

test("color queries cover foreground, background, and selected palette entries", () => {
  assert.equal(formatColorQueries([0, 15]), `${ESC}]10;?${ST}${ESC}]11;?${ST}${ESC}]4;0;?${ST}${ESC}]4;15;?${ST}`);
  assert.throws(() => formatColorQueries([256]), /invalid palette/);
});

test("notification formatters bound and sanitize their protocol payloads", () => {
  const notification = { id: "build.1", title: "Build", body: `done${ESC}]52;c;bad\u0007` };
  assert.equal(formatOsc9Notification(notification), `${ESC}]9;Build: done ]52;c;bad ${ST}`);
  assert.equal(formatOsc777Notification(notification), `${ESC}]777;notify;Build;done ]52:c:bad ${ST}`);
  const osc99 = formatOsc99Notification(notification);
  assert.ok(osc99.includes(`${ESC}]99;i=build.1:p=title:e=1;${Buffer.from("Build").toString("base64")}${ST}`));
  assert.ok(osc99.includes(`p=body:e=1;${Buffer.from("done ]52;c;bad ").toString("base64")}${ST}`));
  assert.throws(() => formatOsc99Notification({ ...notification, id: "bad;id" }), /unsupported/);
});
