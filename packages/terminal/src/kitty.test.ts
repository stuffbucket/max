import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeKittyAnimationControl,
  encodeKittyAnimationFrame,
  encodeKittyAnimationQuery,
  encodeKittyDeleteAnimationFrames,
} from "./kitty.ts";

const APC = "\u001b_G";
const ST = "\u001b\\";

test("animation frames use Kitty frame transfer and chunking", () => {
  const data = "A".repeat(5000);
  const sequence = encodeKittyAnimationFrame(data, { imageId: 7, delayMs: 48, replacePixels: true });
  assert.ok(sequence.startsWith(`${APC}a=f,i=7,f=100,z=48,X=1,m=1;`));
  assert.ok(sequence.includes(`${ST}${APC}m=0;`));
  assert.ok(sequence.endsWith(ST));
});

test("animation controls support terminal-driven loops and frame delay edits", () => {
  assert.equal(encodeKittyAnimationControl({ imageId: 7, state: "loop", loops: 1 }), `${APC}a=a,i=7,s=3,v=1${ST}`);
  assert.equal(encodeKittyAnimationControl({ imageId: 7, frame: 3, frameDelayMs: 80 }), `${APC}a=a,i=7,r=3,z=80${ST}`);
  assert.throws(() => encodeKittyAnimationControl({ imageId: 7, frameDelayMs: 80 }), /frame is required/);
});

test("animation feature queries and frame deletion are explicit", () => {
  assert.equal(encodeKittyAnimationQuery(9, "frame"), `${APC}a=q,i=9,e=f${ST}`);
  assert.equal(encodeKittyAnimationQuery(9, "animation"), `${APC}a=q,i=9,e=a${ST}`);
  assert.equal(encodeKittyDeleteAnimationFrames(9), `${APC}a=d,d=F,i=9${ST}`);
});
