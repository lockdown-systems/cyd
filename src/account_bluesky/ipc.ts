import { ipcMain } from "electron";
import log from "electron-log/main";

import { BlueskyAccountController } from "./bluesky_account_controller";
import type {
  BlueskyLocalAccount,
  BlueskyLocalAccountPaths,
} from "../shared_types";
import { packageExceptionForReport } from "../util";

const controllers: Record<number, BlueskyAccountController> = {};

const getBlueskyAccountController = (
  accountID: number,
): BlueskyAccountController => {
  if (!controllers[accountID]) {
    log.debug("Creating new BlueskyAccountController for accountID", accountID);
    controllers[accountID] = new BlueskyAccountController(accountID);
  }
  controllers[accountID].refreshAccount();
  return controllers[accountID];
};

export const defineIPCBluesky = () => {
  // Open a Bluesky local account, creating its private runtime database, media
  // store, and staging area on first use.
  ipcMain.handle(
    "Bluesky:openLocalAccount",
    async (_, accountID: number): Promise<BlueskyLocalAccount | null> => {
      try {
        const controller = getBlueskyAccountController(accountID);
        controller.initDB();
        return controller.account;
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:getLocalAccountPaths",
    async (_, accountID: number): Promise<BlueskyLocalAccountPaths> => {
      try {
        return getBlueskyAccountController(accountID).getPaths();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // Permanently delete a Bluesky local account. The renderer confirms with the
  // person first and passes back the account UUID it means to destroy.
  ipcMain.handle(
    "Bluesky:deleteLocalAccount",
    async (
      _,
      accountID: number,
      confirmedAccountUUID: string,
    ): Promise<void> => {
      try {
        const controller = getBlueskyAccountController(accountID);
        controller.deleteLocalAccount({ confirmedAccountUUID });
        delete controllers[accountID];
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // Discard staged work left behind by a failed or cancelled job.
  ipcMain.handle(
    "Bluesky:clearStagingAreas",
    async (_, accountID: number): Promise<void> => {
      try {
        getBlueskyAccountController(accountID).clearStagingAreas();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};
