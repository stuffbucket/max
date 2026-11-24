const ESC = "\u001b";
const BEL = "\u0007";
const C1_DCS = 0x90;
const C1_SOS = 0x98;
const C1_CSI = 0x9b;
const C1_ST = 0x9c;
const C1_OSC = 0x9d;
const C1_PM = 0x9e;
const C1_APC = 0x9f;
const SGR_RESET = `${ESC}[0m`;
const OSC8_CLOSE = `${ESC}]8;;${ESC}\\`;

interface ControlString {
  payload: string;
  next: number;
  complete: boolean;
}

interface CsiSequence {
  body: string;
  final: string;
  next: number;
  complete: boolean;
}

function readControlString(input: string, start: number, allowBell: boolean): ControlString {
  for (let index = start; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (allowBell && input[index] === BEL) {
      return { payload: input.slice(start, index), next: index + 1, complete: true };
    }
    if (code === C1_ST) return { payload: input.slice(start, index), next: index + 1, complete: true };
    if (input[index] === ESC && input[index + 1] === "\\") {
      return { payload: input.slice(start, index), next: index + 2, complete: true };
    }
  }
  return { payload: input.slice(start), next: input.length, complete: false };
}

function readCsi(input: string, start: number): CsiSequence {
  for (let index = start; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      return { body: input.slice(start, index), final: input[index] ?? "", next: index + 1, complete: true };
    }
  }
  return { body: input.slice(start), final: "", next: input.length, complete: false };
}

function isFullSgrReset(body: string): boolean {
  if (body === "") return true;
  return body.split(/[;:]/).every((part) => part === "" || /^0+$/.test(part));
}

function safeHyperlink(uri: string): string | undefined {
  if (uri === "" || uri !== uri.trim() || uri.length > 2048) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
  if (parsed.username !== "" || parsed.password !== "") return undefined;
  return parsed.href;
}

/**
 * Preserve text styling and safe web hyperlinks while removing terminal commands from untrusted text.
 * SGR is display-only. OSC 8 is rebuilt from a validated http(s) URL. Every other control sequence is dropped.
 */
export function sanitizeTerminalText(input: string): string {
  let output = "";
  let index = 0;
  let sgrActive = false;
  let hyperlinkOpen = false;

  const closeHyperlink = (): void => {
    if (!hyperlinkOpen) return;
    output += OSC8_CLOSE;
    hyperlinkOpen = false;
  };

  const handleCsi = (start: number): number => {
    const sequence = readCsi(input, start);
    if (
      sequence.complete &&
      sequence.final === "m" &&
      sequence.body.length <= 128 &&
      /^[0-9;:]*$/.test(sequence.body)
    ) {
      output += `${ESC}[${sequence.body}m`;
      sgrActive = !isFullSgrReset(sequence.body);
    }
    return sequence.next;
  };

  const handleOsc = (start: number): number => {
    const sequence = readControlString(input, start, true);
    if (!sequence.complete || !sequence.payload.startsWith("8;")) return sequence.next;
    const uriSeparator = sequence.payload.indexOf(";", 2);
    if (uriSeparator < 0) return sequence.next;
    const uri = sequence.payload.slice(uriSeparator + 1);
    if (uri === "") {
      closeHyperlink();
      return sequence.next;
    }
    const safe = safeHyperlink(uri);
    closeHyperlink();
    if (safe !== undefined) {
      output += `${ESC}]8;;${safe}${ESC}\\`;
      hyperlinkOpen = true;
    }
    return sequence.next;
  };

  while (index < input.length) {
    const char = input[index] ?? "";
    const code = input.charCodeAt(index);

    if (char === ESC) {
      const kind = input[index + 1];
      if (kind === "[") {
        index = handleCsi(index + 2);
        continue;
      }
      if (kind === "]") {
        index = handleOsc(index + 2);
        continue;
      }
      if (kind === "P" || kind === "X" || kind === "^" || kind === "_") {
        index = readControlString(input, index + 2, false).next;
        continue;
      }
      let end = index + 1;
      while (end < input.length) {
        const next = input.charCodeAt(end);
        if (next >= 0x30 && next <= 0x7e) {
          end += 1;
          break;
        }
        if (next < 0x20 || next > 0x2f) break;
        end += 1;
      }
      index = end;
      continue;
    }

    if (code === C1_CSI) {
      index = handleCsi(index + 1);
      continue;
    }
    if (code === C1_OSC) {
      index = handleOsc(index + 1);
      continue;
    }
    if (code === C1_DCS || code === C1_SOS || code === C1_PM || code === C1_APC) {
      index = readControlString(input, index + 1, false).next;
      continue;
    }
    if ((code >= 0 && code < 0x20 && char !== "\n" && char !== "\t") || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      index += 1;
      continue;
    }

    output += char;
    index += 1;
  }

  closeHyperlink();
  if (sgrActive) output += SGR_RESET;
  return output;
}
