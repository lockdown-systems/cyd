import fs from "fs";
import path from "path";

import { vi } from "vitest";

interface HandlerStore {
  onCompleted: Array<(details: unknown) => void>;
  onSendHeaders: Array<(details: unknown) => void>;
}

interface SessionStoreValue {
  instance: Record<string, unknown>;
  handlers: HandlerStore;
}

const handlerStore: Record<string, SessionStoreValue> = {};

const createHandlerStore = (): HandlerStore => ({
  onCompleted: [],
  onSendHeaders: [],
});

const ensureTempDir = (): string => {
  const tmpDir = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "testdata",
    "tmp-electron",
  );
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
};

const createSession = (partition: string): Record<string, unknown> => {
  const handlers = createHandlerStore();
  handlerStore[partition] = { instance: {}, handlers };

  const sessionInstance = {
    webRequest: {
      onCompleted: vi.fn((cb: (details: unknown) => void) => {
        handlers.onCompleted.push(cb);
      }),
      onSendHeaders: vi.fn((cb: (details: unknown) => void) => {
        handlers.onSendHeaders.push(cb);
      }),
    },
    setProxy: vi.fn(async () => Promise.resolve()),
    setCertificateVerifyProc: vi.fn(),
    clearCache: vi.fn(async () => Promise.resolve()),
    fetch: vi.fn(async () => ({ status: 200 })),
    closeAllConnections: vi.fn(async () => Promise.resolve()),
    clearStorageData: vi.fn(async () => Promise.resolve()),
  } as Record<string, unknown>;

  handlerStore[partition].instance = sessionInstance;
  return sessionInstance;
};

const getOrCreateSession = (partition: string): Record<string, unknown> => {
  if (handlerStore[partition]) {
    return handlerStore[partition].instance;
  }
  return createSession(partition);
};

const tmpDir = ensureTempDir();

vi.mock("electron", () => {
  return {
    session: {
      fromPartition: vi.fn((partition: string) =>
        getOrCreateSession(partition),
      ),
    },
    app: {
      getPath: vi.fn(() => tmpDir),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
    },
  };
});

export const electronMockHelpers = {
  triggerOnCompleted: (partition: string, details: unknown) => {
    handlerStore[partition]?.handlers.onCompleted.forEach((handler) =>
      handler(details),
    );
  },
  triggerOnSendHeaders: (partition: string, details: unknown) => {
    handlerStore[partition]?.handlers.onSendHeaders.forEach((handler) =>
      handler(details),
    );
  },
  getSessionMock: (partition: string) => handlerStore[partition]?.instance,
};
