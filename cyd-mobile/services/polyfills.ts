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
