import { vi } from "vitest";

export const fetchMock = vi.fn();

globalThis.fetch = fetchMock as unknown as typeof fetch;

export const resetFetchMock = () => {
  fetchMock.mockReset();
};
