import { ipcMain } from "electron";
import log from "electron-log/main";

import { BlueskyAccountController } from "./bluesky_account_controller";
import { releaseBlueskyHold, type BlueskyConnectStart } from "../bluesky_oauth";
import type {
  BlueskyBrowsePage,
  BlueskyCategory,
  BlueskyCategorySettings,
  BlueskyCollectionProgress,
  BlueskyCollectionResult,
  BlueskyIdentityProfile,
  BlueskyJob,
  BlueskyLocalAccount,
  BlueskyLocalAccountPaths,
  BlueskySavedDataSummary,
  BlueskyStoragePreflight,
} from "../shared_types";
import { blueskyCategoryOfJobType, isBlueskyCategory } from "../shared_types";
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
        // Opening the account is when a save interrupted by a quit becomes
        // available to carry on.
        controller.resumeInterruptedJobs();
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

  // Which categories this account saves. Turning one off stops future
  // collection and never deletes Bluesky saved data.
  ipcMain.handle(
    "Bluesky:getCategorySettings",
    async (_, accountID: number): Promise<BlueskyCategorySettings> => {
      try {
        return getBlueskyAccountController(accountID).getCategorySettings();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:setCategoryEnabled",
    async (
      _,
      accountID: number,
      category: string,
      enabled: boolean,
    ): Promise<void> => {
      try {
        getBlueskyAccountController(accountID).setCategoryEnabled(
          requireCategory(category),
          enabled,
        );
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // What a run over these categories is expected to need on disk.
  ipcMain.handle(
    "Bluesky:storagePreflight",
    async (
      _,
      accountID: number,
      categories: string[],
    ): Promise<BlueskyStoragePreflight> => {
      try {
        const controller = getBlueskyAccountController(accountID);
        const client = await controller.getATClient();
        return await controller.storagePreflight(
          client,
          categories.map(requireCategory),
        );
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:createJobs",
    async (_, accountID: number, jobTypes: string[]): Promise<BlueskyJob[]> => {
      try {
        return getBlueskyAccountController(accountID).createJobs(jobTypes);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:getJobs",
    async (_, accountID: number, status?: string): Promise<BlueskyJob[]> => {
      try {
        return getBlueskyAccountController(accountID).getJobs(status);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  /**
   * Run one save job to completion, or until it is cancelled, rate limited past
   * patience, or out of disk.
   *
   * The job row is what survives a restart. A job still marked running when the
   * account is next opened is returned to the pending queue, and the engine's
   * checkpoint means running it again continues rather than starts over.
   */
  ipcMain.handle(
    "Bluesky:runJob",
    async (
      _,
      accountID: number,
      jobID: number,
    ): Promise<BlueskyCollectionResult> => {
      try {
        const controller = getBlueskyAccountController(accountID);
        const job = controller.getJobs().find((each) => each.id === jobID);
        if (!job) {
          throw new Error(`Bluesky job ${jobID} not found`);
        }
        const category = blueskyCategoryOfJobType(job.jobType);
        if (!category) {
          throw new Error(`Bluesky job ${jobID} does not save a category`);
        }

        job.status = "running";
        job.startedAt = new Date();
        controller.updateJob(job);

        const client = await controller.getATClient();
        const result = await controller.collect(category, {
          client,
          onProgress: (progress) => {
            // Progress is stored on the job so an interrupted run leaves a
            // durable account of how far it got. It carries operational
            // metadata only.
            job.progressJSON = JSON.stringify(progress);
            controller.updateJob(job);
          },
        });

        job.status =
          result.outcome === "finished" ? "finished" : result.outcome;
        job.finishedAt = new Date();
        job.progressJSON = JSON.stringify(result.progress);
        job.error = result.errorClass;
        controller.updateJob(job);

        return result;
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:getCollectionProgress",
    async (_, accountID: number): Promise<BlueskyCollectionProgress | null> => {
      try {
        return getBlueskyAccountController(accountID).collectionProgress;
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:cancelCollection",
    async (_, accountID: number): Promise<void> => {
      try {
        getBlueskyAccountController(accountID).cancelCollection();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // One chronological page of Bluesky saved data, read with no connection and
  // no network.
  ipcMain.handle(
    "Bluesky:browse",
    async (
      _,
      accountID: number,
      category: string,
      before: string | null,
      limit?: number,
    ): Promise<BlueskyBrowsePage> => {
      try {
        return getBlueskyAccountController(accountID).browse({
          category: requireCategory(category),
          before,
          limit,
        });
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle(
    "Bluesky:getSavedDataSummary",
    async (_, accountID: number): Promise<BlueskySavedDataSummary> => {
      try {
        return getBlueskyAccountController(accountID).savedDataSummary();
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  // Where a saved asset's bytes are, so the renderer can show them from disk.
  ipcMain.handle(
    "Bluesky:getMediaPath",
    async (_, accountID: number, digest: string): Promise<string | null> => {
      try {
        return (
          getBlueskyAccountController(accountID).getMedia(digest)?.path ?? null
        );
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};

/**
 * A category name that came in over IPC. The renderer is not trusted to name a
 * category Cyd knows, and an unknown one must not reach a query.
 */
const requireCategory = (category: string): BlueskyCategory => {
  if (!isBlueskyCategory(category)) {
    throw new Error(`Unknown Bluesky category: ${category}`);
  }
  return category;
};
