import { ipcMain } from "electron";
import log from "electron-log/main";

import { BlueskyAccountController } from "./bluesky_account_controller";
import { releaseBlueskyHold, type BlueskyConnectStart } from "../bluesky_oauth";
import type {
  BlueskyIdentityProfile,
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

  // Start a browser authorization for a Bluesky handle.
  ipcMain.handle(
    "Bluesky:connect",
    async (
      _,
      accountID: number,
      handle: string,
    ): Promise<BlueskyConnectStart> => {
      try {
        return await getBlueskyAccountController(accountID).connect(handle);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // Finish an authorization that came back through the callback URL.
  ipcMain.handle(
    "Bluesky:completeConnection",
    async (
      _,
      accountID: number,
      queryString: string,
    ): Promise<true | string> => {
      try {
        return await getBlueskyAccountController(accountID).completeConnection(
          queryString,
        );
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // The identity's current profile, or null when this account is not
  // connected to one.
  ipcMain.handle(
    "Bluesky:getProfile",
    async (_, accountID: number): Promise<BlueskyIdentityProfile | null> => {
      try {
        const controller = getBlueskyAccountController(accountID);
        if (!controller.isConnected || !controller.account?.did) {
          return null;
        }
        await controller.refreshProfile();
        const account = controller.account;
        return account?.did && account.handle
          ? {
              did: account.did,
              handle: account.handle,
              displayName: account.displayName ?? undefined,
              avatar: account.profileImageDataURI ?? undefined,
            }
          : null;
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // Remove this installation's authorization, keeping the local account and
  // all its Bluesky saved data.
  ipcMain.handle(
    "Bluesky:disconnect",
    async (_, accountID: number): Promise<void> => {
      try {
        await getBlueskyAccountController(accountID).disconnect();
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
        // The account is about to stop existing, which is what releases its
        // hold. Remember the identity first so the hold can be released once
        // it is gone.
        const did = controller.account?.did ?? null;
        controller.deleteLocalAccount({ confirmedAccountUUID });
        delete controllers[accountID];
        if (did) {
          await releaseBlueskyHold(did);
        }
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
