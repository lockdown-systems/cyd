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
