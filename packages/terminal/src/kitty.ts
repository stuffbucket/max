const APC = "\u001b_G";
const ST = "\u001b\\";
const CHUNK_SIZE = 4096;

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

function command(controls: Readonly<Record<string, string | number>>): string {
  return Object.entries(controls).map(([key, value]) => `${key}=${value}`).join(",");
}

function chunked(controls: Readonly<Record<string, string | number>>, base64Data: string): string {
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) throw new Error("Kitty image data must be base64");
  const chunks = base64Data.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
  if (chunks.length === 0) throw new Error("Kitty image data must not be empty");
  return chunks.map((chunk, index) => {
    const more = index < chunks.length - 1 ? 1 : 0;
    const prefix = index === 0 ? `${command({ ...controls, m: more })};` : `m=${more};`;
    return `${APC}${prefix}${chunk}${ST}`;
  }).join("");
}

export interface KittyAnimationFrameOptions {
  imageId: number;
  delayMs?: number;
  editFrame?: number;
  baseFrame?: number;
  replacePixels?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export function encodeKittyAnimationFrame(pngBase64: string, options: KittyAnimationFrameOptions): string {
  const controls: Record<string, string | number> = {
    a: "f",
    i: positiveInteger(options.imageId, "imageId"),
    f: 100,
  };
  if (options.delayMs !== undefined) controls.z = nonNegativeInteger(options.delayMs, "delayMs");
  if (options.editFrame !== undefined) controls.r = positiveInteger(options.editFrame, "editFrame");
  if (options.baseFrame !== undefined) controls.c = positiveInteger(options.baseFrame, "baseFrame");
  if (options.replacePixels === true) controls.X = 1;
  if (options.x !== undefined) controls.x = nonNegativeInteger(options.x, "x");
  if (options.y !== undefined) controls.y = nonNegativeInteger(options.y, "y");
  if (options.width !== undefined) controls.s = positiveInteger(options.width, "width");
  if (options.height !== undefined) controls.v = positiveInteger(options.height, "height");
  return chunked(controls, pngBase64);
}

export type KittyAnimationState = "stop" | "loading" | "loop";

export interface KittyAnimationControlOptions {
  imageId: number;
  state?: KittyAnimationState;
  loops?: number;
  frame?: number;
  frameDelayMs?: number;
}

export function encodeKittyAnimationControl(options: KittyAnimationControlOptions): string {
  const controls: Record<string, string | number> = { a: "a", i: positiveInteger(options.imageId, "imageId") };
  if (options.state !== undefined) controls.s = { stop: 1, loading: 2, loop: 3 }[options.state];
  if (options.loops !== undefined) controls.v = nonNegativeInteger(options.loops, "loops");
  if (options.frame !== undefined) controls.c = positiveInteger(options.frame, "frame");
  if (options.frameDelayMs !== undefined) {
    if (options.frame === undefined) throw new Error("frame is required when changing a frame delay");
    controls.r = positiveInteger(options.frame, "frame");
    controls.z = nonNegativeInteger(options.frameDelayMs, "frameDelayMs");
    delete controls.c;
  }
  return `${APC}${command(controls)}${ST}`;
}

export function encodeKittyAnimationQuery(imageId: number, feature: "frame" | "animation" | "compose" = "frame"): string {
  const code = { frame: "f", animation: "a", compose: "c" }[feature];
  return `${APC}${command({ a: "q", i: positiveInteger(imageId, "imageId"), e: code })}${ST}`;
}

export function encodeKittyDeleteAnimationFrames(imageId: number, freeData = true): string {
  return `${APC}${command({ a: "d", d: freeData ? "F" : "f", i: positiveInteger(imageId, "imageId") })}${ST}`;
}
