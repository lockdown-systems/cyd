export * from "./backend";
export * from "./store";
export * from "./legacy";

// IPC

import { ipcMain } from "electron";

import { getCredentialProtection } from "./backend";
import { packageExceptionForReport } from "../util";
import type { CredentialProtection } from "../shared_types";

export const defineIPCCredentials = () => {
  // The renderer asks how credentials are protected so it can disclose a
  // weak backend to the user. It never receives a credential itself.
  ipcMain.handle(
    "credentials:getProtection",
    async (): Promise<CredentialProtection> => {
      try {
        return getCredentialProtection();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};
