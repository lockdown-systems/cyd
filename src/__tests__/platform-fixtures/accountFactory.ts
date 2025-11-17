import fs from "fs";

import {
  runMainMigrations,
  closeMainDatabase,
  createAccount,
  selectAccountType,
  saveAccount,
} from "../../database";
import { getSettingsPath } from "../../util";
import type { Account } from "../../shared_types";

export type PlatformAccountType = "X" | "Bluesky" | "Facebook";

export interface TestAccountOptions {
  type: PlatformAccountType;
  username?: string;
  mutateAccount?: (account: Account) => void;
}

export interface TestAccountHandle {
  account: Account;
  cleanup(): void;
}

export const createTestAccount = (
  options: TestAccountOptions,
): TestAccountHandle => {
  runMainMigrations();

  let account = createAccount();
  account = selectAccountType(account.id, options.type);

  if (options.mutateAccount) {
    options.mutateAccount(account);
  }

  switch (options.type) {
    case "X":
      if (account.xAccount) {
        account.xAccount.username =
          options.username ?? account.xAccount.username ?? "test";
      }
      break;
    case "Bluesky":
      if (account.blueskyAccount) {
        account.blueskyAccount.username =
          options.username ?? account.blueskyAccount.username ?? "test";
      }
      break;
    case "Facebook":
      if (account.facebookAccount) {
        account.facebookAccount.name =
          options.username ?? account.facebookAccount.name ?? "test";
      }
      break;
  }

  saveAccount(account);

  return {
    account,
    cleanup: () => {
      closeMainDatabase();

      // Delete database files to ensure clean state for next test
      const settingsPath = getSettingsPath();
      try {
        fs.rmSync(settingsPath, { recursive: true, force: true });
      } catch {
        // Ignore errors - directory might not exist or files might be locked
      }
    },
  };
};
