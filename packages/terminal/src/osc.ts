const ESC = "\u001b";
const ST = `${ESC}\\`;

function cleanText(value: string, limit: number): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, limit);
}

function base64(value: string, limit: number): string {
  return Buffer.from(cleanText(value, limit), "utf8").toString("base64");
}

export type TitleScope = "icon-and-window" | "window";

export function formatTitle(title: string, scope: TitleScope = "icon-and-window"): string {
  const code = scope === "window" ? 2 : 0;
  return `${ESC}]${code};${cleanText(title, 1024)}${ST}`;
}

export type ClipboardSelection = "clipboard" | "primary";

export function formatClipboard(text: string, selection: ClipboardSelection = "clipboard"): string {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > 1024 * 1024) throw new Error("clipboard text exceeds the 1 MiB Max limit");
  return `${ESC}]52;${selection === "primary" ? "p" : "c"};${Buffer.from(text, "utf8").toString("base64")}${ST}`;
}

export function formatColorQueries(indices: readonly number[] = Array.from({ length: 16 }, (_, index) => index)): string {
  const palette = indices.map((index) => {
    if (!Number.isInteger(index) || index < 0 || index > 255) throw new Error(`invalid palette index ${index}`);
    return `${ESC}]4;${index};?${ST}`;
  });
  return `${ESC}]10;?${ST}${ESC}]11;?${ST}${palette.join("")}`;
}

export interface Notification {
  title: string;
  body: string;
  id?: string;
}

function notificationId(value: string | undefined): string {
  if (value === undefined) return "max";
  if (!/^[A-Za-z0-9_.+-]{1,64}$/.test(value)) throw new Error("notification id contains unsupported characters");
  return value;
}

export function formatOsc9Notification(notification: Notification): string {
  const text = cleanText(notification.title === "" ? notification.body : `${notification.title}: ${notification.body}`, 4096);
  return `${ESC}]9;${text}${ST}`;
}

export function formatOsc99Notification(notification: Notification): string {
  const id = notificationId(notification.id);
  const title = base64(notification.title, 2048);
  const body = base64(notification.body, 4096);
  return `${ESC}]99;i=${id}:p=title:e=1;${title}${ST}${ESC}]99;i=${id}:p=body:e=1;${body}${ST}`;
}

export function formatOsc777Notification(notification: Notification): string {
  const title = cleanText(notification.title, 1024).replaceAll(";", ":");
  const body = cleanText(notification.body, 4096).replaceAll(";", ":");
  return `${ESC}]777;notify;${title};${body}${ST}`;
}
