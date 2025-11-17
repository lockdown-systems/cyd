import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { vi, beforeEach } from "vitest";

// Ensure every Vitest worker uses an isolated settings database so the
// SQLite migrations do not clash when suites run in parallel.
const repoRoot = path.resolve(__dirname, "../../..");
const workerID = process.env.VITEST_WORKER_ID ?? randomUUID();
const settingsPath = path.join(
  repoRoot,
  "testdata",
  "settingsPath-database",
  `worker-${workerID}`,
);
const dataPath = path.join(repoRoot, "testdata", "dataPath");
fs.mkdirSync(settingsPath, { recursive: true });
fs.mkdirSync(dataPath, { recursive: true });
process.env.TEST_MODE = "1";
process.env.TEST_SETTINGS_PATH = settingsPath;
process.env.TEST_DATA_PATH = dataPath;

// Mock Bootstrap Modal to avoid DOM compatibility issues in tests
vi.mock("bootstrap/js/dist/modal", () => {
  class MockModal {
    show = vi.fn();
    hide = vi.fn();
    dispose = vi.fn();
  }
  return {
    default: MockModal,
  };
});

// Mock fetch for API requests in all GUI tests
global.fetch = vi.fn();

// Fix jsdom DOM event compatibility issues
Object.defineProperty(window, "MouseEvent", {
  value: class MockMouseEvent {
    constructor(type: string, eventInit?: MouseEventInit) {
      this.type = type;
      Object.assign(this, eventInit);
    }
    type: string;
    preventDefault = vi.fn();
    stopPropagation = vi.fn();
  },
});

Object.defineProperty(window, "KeyboardEvent", {
  value: class MockKeyboardEvent {
    constructor(type: string, eventInit?: KeyboardEventInit) {
      this.type = type;
      Object.assign(this, eventInit);
    }
    type: string;
    preventDefault = vi.fn();
    stopPropagation = vi.fn();
  },
});

Object.defineProperty(window, "Event", {
  value: class MockEvent {
    constructor(type: string, eventInit?: EventInit) {
      this.type = type;
      this.bubbles = eventInit?.bubbles || false;
      this.cancelable = eventInit?.cancelable || false;
      this.composed = eventInit?.composed || false;
      Object.assign(this, eventInit);
    }
    type: string;
    bubbles: boolean;
    cancelable: boolean;
    composed: boolean;
    preventDefault = vi.fn();
    stopPropagation = vi.fn();
    stopImmediatePropagation = vi.fn();
  },
});

Object.defineProperty(window, "FocusEvent", {
  value: class MockFocusEvent extends window.Event {
    constructor(type: string, eventInit?: FocusEventInit) {
      super(type, eventInit);
      this.relatedTarget = eventInit?.relatedTarget || null;
    }
    relatedTarget: EventTarget | null;
  },
});

Object.defineProperty(window, "InputEvent", {
  value: class MockInputEvent extends window.Event {
    constructor(type: string, eventInit?: InputEventInit) {
      super(type, eventInit);
      this.data = eventInit?.data || null;
      this.inputType = eventInit?.inputType || "";
    }
    data: string | null;
    inputType: string;
  },
});

// Setup global window.electron for all tests
beforeEach(() => {
  // This will be imported from test_util in individual test files
  // We don't import it here to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = (global as any).window || {};
});
