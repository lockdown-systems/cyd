import { BlueskyAccountController } from "../../bluesky_account_controller";
import type { Account } from "../../../shared_types";
import { createTestAccount } from "../../../__tests__/platform-fixtures/accountFactory";

export interface BlueskyLocalAccountHandle {
  account: Account;
  controller: BlueskyAccountController;
}

export interface BlueskyControllerTestContext {
  /** Create another Bluesky local account alongside the existing ones. */
  createLocalAccount(handle?: string): BlueskyLocalAccountHandle;
  /** Open an existing local account again, as a restarted app would. */
  reopenLocalAccount(accountID: number): BlueskyAccountController;
  cleanup(): void;
}

/**
 * Creates Bluesky local accounts backed by a real temporary main database and
 * real temporary per-account storage, so tests exercise the storage isolation
 * they claim to.
 */
export const createBlueskyControllerTestContext =
  (): BlueskyControllerTestContext => {
    const controllers: BlueskyAccountController[] = [];
    const accountCleanups: Array<() => void> = [];

    const openController = (accountID: number): BlueskyAccountController => {
      const controller = new BlueskyAccountController(accountID);
      controller.initDB();
      controllers.push(controller);
      return controller;
    };

    return {
      createLocalAccount: (handle?: string): BlueskyLocalAccountHandle => {
        const { account, cleanup } = createTestAccount({
          type: "Bluesky",
          username: handle,
        });
        accountCleanups.push(cleanup);
        return { account, controller: openController(account.id) };
      },
      reopenLocalAccount: openController,
      cleanup: () => {
        for (const controller of controllers) {
          controller.cleanup();
        }
        controllers.length = 0;
        // Every account handle cleans up the same shared main database, so one
        // pass is enough.
        accountCleanups.pop()?.();
        accountCleanups.length = 0;
      },
    };
  };
