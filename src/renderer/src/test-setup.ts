import { vi, beforeEach } from "vitest";

// Mock Bootstrap Modal to avoid DOM compatibility issues in tests
vi.mock("bootstrap/js/dist/modal", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    })),
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

// Setup global window.electron for all tests
beforeEach(() => {
  // This will be imported from test_util in individual test files
  // We don't import it here to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = (global as any).window || {};
});
