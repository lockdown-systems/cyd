/* eslint-disable @typescript-eslint/no-require-imports */
import { install } from "react-native-quick-crypto";

install();

if (typeof global.TextEncoder === "undefined") {
  const TextEncoding = require("text-encoding");
  global.TextEncoder = TextEncoding.TextEncoder;
  global.TextDecoder = TextEncoding.TextDecoder;
}

if (typeof Intl.Segmenter === "undefined") {
  require("@formatjs/intl-segmenter/polyfill");
}

if (
  typeof globalThis.AbortController === "undefined" ||
  typeof globalThis.AbortSignal === "undefined"
) {
  class PolyfillAbortSignal extends EventTarget implements AbortSignal {
    aborted = false;
    onabort: ((this: AbortSignal, ev: Event) => any) | null = null;
    reason: any;
    throwIfAborted(): void {
      if (this.aborted) {
        throw this.reason ?? new Error("AbortError");
      }
    }
  }

  class PolyfillAbortController implements AbortController {
    signal: PolyfillAbortSignal;
    constructor() {
      this.signal = new PolyfillAbortSignal();
    }
    abort(reason?: any): void {
      if (this.signal.aborted) {
        return;
      }
      this.signal.aborted = true;
      this.signal.reason = reason ?? new Error("AbortError");
      const event = new Event("abort");
      this.signal.dispatchEvent(event);
      this.signal.onabort?.(event);
    }
  }

  (globalThis as any).AbortController = PolyfillAbortController;
  (globalThis as any).AbortSignal = PolyfillAbortSignal;
}

if (typeof (globalThis.AbortSignal as any).timeout !== "function") {
  (globalThis.AbortSignal as any).timeout = function timeout(ms: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const reason =
        typeof DOMException === "function"
          ? new DOMException("Timeout", "TimeoutError")
          : new Error("TimeoutError");
      // Passing reason only if supported by the current environment
      try {
        controller.abort(reason);
      } catch {
        controller.abort();
      }
    }, ms);
    controller.signal.addEventListener("abort", () => clearTimeout(timer));
    return controller.signal;
  };
}

if (typeof globalThis.CryptoKey === "undefined") {
  const cryptoInstance = globalThis.crypto as any;
  if (cryptoInstance?.CryptoKey) {
    (globalThis as any).CryptoKey = cryptoInstance.CryptoKey;
  } else {
    const {
      CryptoKey,
    } = require("react-native-quick-crypto/lib/commonjs/keys/classes");
    (globalThis as any).CryptoKey = CryptoKey;
  }
}

const cryptoInstance = globalThis.crypto as Crypto | undefined;
if (cryptoInstance?.subtle) {
  patchEcdsaSubtle(cryptoInstance.subtle);
}

// Polyfill Event for @atproto/oauth-client
if (typeof globalThis.Event === "undefined") {
  (globalThis as any).Event = class Event {
    type: string;
    bubbles: boolean;
    cancelable: boolean;
    constructor(type: string, eventInitDict?: EventInit) {
      this.type = type;
      this.bubbles = eventInitDict?.bubbles ?? false;
      this.cancelable = eventInitDict?.cancelable ?? false;
    }
  };
}

// Polyfill EventTarget for @atproto/oauth-client
if (typeof globalThis.EventTarget === "undefined") {
  (globalThis as any).EventTarget = class EventTarget {
    private listeners: Record<string, EventListenerOrEventListenerObject[]> =
      {};

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) {
      if (!listener) return;
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(listener);
    }

    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) {
      if (!listener || !this.listeners[type]) return;
      const index = this.listeners[type].indexOf(listener);
      if (index !== -1) {
        this.listeners[type].splice(index, 1);
      }
    }

    dispatchEvent(event: Event): boolean {
      if (!this.listeners[event.type]) return true;
      this.listeners[event.type].forEach((listener) => {
        if (typeof listener === "function") {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      });
      return true;
    }
  };
}

// Polyfill CustomEvent for @atproto/oauth-client
if (typeof globalThis.CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class CustomEvent extends (
    (globalThis as any).Event
  ) {
    detail: any;
    constructor(type: string, eventInitDict?: CustomEventInit) {
      super(type, eventInitDict);
      this.detail = eventInitDict?.detail;
    }
  };
}

function patchEcdsaSubtle(subtle: SubtleCrypto) {
  const originalSign = subtle.sign.bind(subtle);
  const originalVerify = subtle.verify.bind(subtle);

  subtle.sign = async function patchedSign(
    algorithm: AlgorithmIdentifier,
    key: CryptoKey,
    data: BufferSource,
  ) {
    const result = await originalSign(algorithm, key, data);
    const size = getEcdsaComponentSize(algorithm, key);
    if (!size) {
      return result;
    }
    return derToP1363Signature(result, size);
  } as typeof subtle.sign;

  subtle.verify = async function patchedVerify(
    algorithm: AlgorithmIdentifier,
    key: CryptoKey,
    signature: BufferSource,
    data: BufferSource,
  ) {
    const size = getEcdsaComponentSize(algorithm, key);
    const normalizedSignature = size
      ? p1363ToDerSignature(signature, size)
      : signature;
    return originalVerify(algorithm, key, normalizedSignature, data);
  } as typeof subtle.verify;
}

function getEcdsaComponentSize(
  algorithm: AlgorithmIdentifier,
  key: CryptoKey,
): number | null {
  const algoName =
    typeof algorithm === "string" ? algorithm : (algorithm?.name ?? "");
  if (algoName.toUpperCase() !== "ECDSA") {
    return null;
  }
  const curveName =
    typeof algorithm === "object" && "namedCurve" in algorithm
      ? (algorithm as EcKeyAlgorithm).namedCurve
      : ((key.algorithm as EcKeyAlgorithm | undefined)?.namedCurve ?? null);
  switch (curveName) {
    case "P-256":
      return 32;
    case "P-384":
      return 48;
    case "P-521":
      return 66;
    default:
      return null;
  }
}

function derToP1363Signature(
  signature: ArrayBuffer,
  size: number,
): ArrayBuffer {
  const bytes = new Uint8Array(signature);
  if (bytes[0] !== 0x30) {
    throw new Error("Invalid DER signature");
  }
  let offset = 1;
  let length = bytes[offset++];
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    length = 0;
    for (let i = 0; i < lengthBytes; i += 1) {
      length = (length << 8) | bytes[offset++];
    }
  }
  if (bytes[offset++] !== 0x02) {
    throw new Error("Invalid DER signature");
  }
  const rLength = bytes[offset++];
  const r = bytes.slice(offset, offset + rLength);
  offset += rLength;
  if (bytes[offset++] !== 0x02) {
    throw new Error("Invalid DER signature");
  }
  const sLength = bytes[offset++];
  const s = bytes.slice(offset, offset + sLength);
  const rPadded = padSignatureComponent(r, size);
  const sPadded = padSignatureComponent(s, size);
  const result = new Uint8Array(size * 2);
  result.set(rPadded, 0);
  result.set(sPadded, size);
  return result.buffer;
}

function p1363ToDerSignature(
  signature: BufferSource,
  size: number,
): ArrayBuffer {
  const bytes = toUint8Array(signature);
  if (bytes.length !== size * 2) {
    throw new Error("Invalid ECDSA signature length");
  }
  const r = encodeSignatureComponent(bytes.slice(0, size));
  const s = encodeSignatureComponent(bytes.slice(size));
  const totalLength = r.length + s.length + 4;
  const needsLongLength = totalLength >= 128;
  const der = new Uint8Array(totalLength + (needsLongLength ? 3 : 2));
  let offset = 0;
  der[offset++] = 0x30;
  if (needsLongLength) {
    der[offset++] = 0x81;
    der[offset++] = totalLength;
  } else {
    der[offset++] = totalLength;
  }
  der[offset++] = 0x02;
  der[offset++] = r.length;
  der.set(r, offset);
  offset += r.length;
  der[offset++] = 0x02;
  der[offset++] = s.length;
  der.set(s, offset);
  return der.buffer;
}

function padSignatureComponent(
  component: Uint8Array,
  size: number,
): Uint8Array {
  let trimmed = trimLeadingZeros(component);
  if (trimmed.length > size) {
    trimmed = trimmed.slice(trimmed.length - size);
  }
  if (trimmed.length === size) {
    return trimmed;
  }
  const padded = new Uint8Array(size);
  padded.set(trimmed, size - trimmed.length);
  return padded;
}

function encodeSignatureComponent(component: Uint8Array): Uint8Array {
  let trimmed = trimLeadingZeros(component);
  if (trimmed.length === 0) {
    trimmed = new Uint8Array([0]);
  }
  if (trimmed[0] & 0x80) {
    const prefixed = new Uint8Array(trimmed.length + 1);
    prefixed.set(trimmed, 1);
    return prefixed;
  }
  return trimmed;
}

function trimLeadingZeros(bytes: Uint8Array): Uint8Array {
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) {
    offset += 1;
  }
  return bytes.slice(offset);
}

function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}
