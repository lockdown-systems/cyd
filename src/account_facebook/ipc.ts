import { ipcMain } from "electron";

import { FacebookAccountController } from "./facebook_account_controller";

import {
  FacebookJob,
  FacebookProgress,
  FacebookDatabaseStats,
} from "../shared_types";
import { getMITMController } from "../mitm";
import { packageExceptionForReport } from "../util";

const controllers: Record<number, FacebookAccountController> = {};

const getFacebookAccountController = (
  accountID: number,
): FacebookAccountController => {
  if (!controllers[accountID]) {
    controllers[accountID] = new FacebookAccountController(
      accountID,
      getMITMController(accountID),
    );
  }
  controllers[accountID].refreshAccount();
  return controllers[accountID];
};

export const defineIPCFacebook = () => {
  ipcMain.handle(
    "Facebook:resetProgress",
    async (_, accountID: number): Promise<FacebookProgress> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return controller.resetProgress();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

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
    "Facebook:archiveBuild",
    async (_, accountID: number): Promise<void> => {
      try {
        const controller = getFacebookAccountController(accountID);
        await controller.archiveBuild();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:syncProgress",
    async (_, accountID: number, progressJSON: string) => {
      try {
        const controller = getFacebookAccountController(accountID);
        await controller.syncProgress(progressJSON);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:getProgress",
    async (_, accountID: number): Promise<FacebookProgress> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.getProgress();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:getCookie",
    async (_, accountID: number, name: string): Promise<string | null> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.getCookie(name);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Facebook:getProfileImageDataURI",
    async (
      _,
      accountID: number,
      profilePictureURI: string,
    ): Promise<string> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.getProfileImageDataURI(profilePictureURI);
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
    "Facebook:savePosts",
    async (_, accountID: number): Promise<FacebookProgress> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.savePosts();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle("Facebook:indexStart", async (_, accountID: number) => {
    try {
      const controller = getFacebookAccountController(accountID);
      await controller.indexStart();
    } catch (error) {
      throw new Error(packageExceptionForReport(error as Error));
    }
  });

  ipcMain.handle("Facebook:indexStop", async (_, accountID: number) => {
    try {
      const controller = getFacebookAccountController(accountID);
      await controller.indexStop();
    } catch (error) {
      throw new Error(packageExceptionForReport(error as Error));
    }
  });

  ipcMain.handle(
    "Facebook:getDatabaseStats",
    async (_, accountID: number): Promise<FacebookDatabaseStats> => {
      try {
        const controller = getFacebookAccountController(accountID);
        return await controller.getDatabaseStats();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};
