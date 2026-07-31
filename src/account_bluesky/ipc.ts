import { ipcMain } from "electron";

import { packageExceptionForReport } from "../util";
import { BlueskyLocalAccountController } from "./bluesky_account_controller";

export const defineIPCBluesky = (): void => {
  ipcMain.handle("Bluesky:openLocalAccount", async (_, accountID: number) => {
    const controller = new BlueskyLocalAccountController(accountID);
    try {
      controller.open();
      controller.close();
    } catch (error) {
      controller.close();
      throw new Error(packageExceptionForReport(error as Error));
    }
  });
};
