export * from "./common";
export * from "./migrations";

export * from "./config";
export * from "./error_report";

export * from "./account";
export * from "./x_account";
export * from "./bluesky_account";

// IPC

import { defineIPCDatabaseConfig } from "./config";
import { defineIPCDatabaseErrorReport } from "./error_report";
import { defineIPCDatabaseAccount } from "./account";

export const defineIPCDatabase = () => {
  defineIPCDatabaseConfig();
  defineIPCDatabaseErrorReport();
  defineIPCDatabaseAccount();
};
