import { ipcMain } from "electron";
import log from "electron-log/main";

import { FacebookAccountController } from "./facebook_account_controller";
import { FacebookJob, FacebookProgressInfo } from "../shared_types";
import { getMITMController } from "../mitm";
import { packageExceptionForReport } from "../util";

const controllers: Record<number, FacebookAccountController> = {};

const getFacebookAccountController = (
  accountID: number,
): FacebookAccountController => {
  if (!controllers[accountID]) {
    log.debug(
      "Creating new FacebookAccountController for accountID",
      accountID,
    );
    controllers[accountID] = new FacebookAccountController(
      accountID,
      getMITMController(accountID),
    );
  }
  log.debug(
    "Returning existing FacebookAccountController for accountID",
    accountID,
  );
  controllers[accountID].refreshAccount();
  return controllers[accountID];
};

export const defineIPCFacebook = () => {
  ipcMain.handle(
    "Facebook:createJobs",
    async (
      _,
      accountID: number,
      jobTypes: string[],
    ): Promise<FacebookJob[]> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return controller.createJobs(jobTypes);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:getLastFinishedJob",
    async (
      _,
      accountID: number,
      jobType: string,
    ): Promise<FacebookJob | null> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return controller.getLastFinishedJob(jobType);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:updateJob",
    async (_, accountID: number, jobJSON: string) => {
      try {
        const controller = getFacebookAccountController(accountID);
        const job = JSON.parse(jobJSON) as FacebookJob;
        controller.updateJob(job);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:getProgressInfo",
    async (_, accountID: number): Promise<FacebookProgressInfo> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.getProgressInfo();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:getConfig",
    async (_, accountID: number, key: string): Promise<string | null> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.getConfig(key);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:setConfig",
    async (_, accountID: number, key: string, value: string): Promise<void> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.setConfig(key, value);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:deleteConfig",
    async (_, accountID: number, key: string): Promise<void> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.deleteConfig(key);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:deleteConfigLike",
    async (_, accountID: number, key: string): Promise<void> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.deleteConfigLike(key);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:incrementTotalWallPostsDeleted",
    async (_, accountID: number, count: number): Promise<void> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.incrementTotalWallPostsDeleted(count);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};
