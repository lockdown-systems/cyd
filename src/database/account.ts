import { ipcMain, session } from "electron";

import { exec, getMainDatabase, Sqlite3Info } from "./common";
import { createXAccount, getXAccount, saveXAccount } from "./x_account";
import {
  createBlueskyLocalAccount,
  getBlueskyLocalAccount,
  saveBlueskyLocalAccount,
} from "./bluesky_account";
import {
  createFacebookAccount,
  getFacebookAccount,
  saveFacebookAccount,
} from "./facebook_account";
import {
  Account,
  XAccount,
  BlueskyLocalAccount,
  FacebookAccount,
} from "../shared_types";
import { packageExceptionForReport } from "../util";

// Types

interface AccountRow {
  id: number;
  type: string;
  sortOrder: number;
  xAccountId: number | null;
  facebookAccountID: number | null;
  uuid: string;
}

function accountFromAccountRow(row: AccountRow): Account {
  let xAccount: XAccount | null = null;
  let blueskyLocalAccount: BlueskyLocalAccount | null = null;
  let facebookAccount: FacebookAccount | null = null;
  switch (row.type) {
    case "X":
      if (row.xAccountId) {
        xAccount = getXAccount(row.xAccountId);
      }
      break;

    case "Bluesky":
      blueskyLocalAccount = getBlueskyLocalAccount(row.uuid);
      break;

    case "Facebook":
      if (row.facebookAccountID) {
        facebookAccount = getFacebookAccount(row.facebookAccountID);
      }
      break;
  }

  return {
    id: row.id,
    type: row.type,
    sortOrder: row.sortOrder,
    xAccount: xAccount,
    blueskyLocalAccount,
    facebookAccount: facebookAccount,
    uuid: row.uuid,
  };
}

// Functions

export const getAccount = (id: number): Account | null => {
  const row: AccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM account WHERE id = ?",
    [id],
    "get",
  ) as AccountRow | undefined;
  if (!row) {
    return null;
  }

  return accountFromAccountRow(row);
};

export async function getAccountUsername(
  account: Account,
): Promise<string | null> {
  if (account.type == "X" && account.xAccount) {
    return account.xAccount?.username;
  } else if (account.type == "Bluesky" && account.blueskyLocalAccount) {
    return account.blueskyLocalAccount.handle;
  } else if (account.type == "Facebook" && account.facebookAccount) {
    return account.facebookAccount?.username;
  }

  return null;
}

export const getAccounts = (): Account[] => {
  const rows: AccountRow[] = exec(
    getMainDatabase(),
    "SELECT * FROM account",
    [],
    "all",
  ) as AccountRow[];

  const accounts: Account[] = [];
  for (const row of rows) {
    accounts.push(accountFromAccountRow(row));
  }
  return accounts;
};

export const createAccount = (): Account => {
  // Figure out the sortOrder for the new account
  const row: { maxSortOrder: number } = exec(
    getMainDatabase(),
    "SELECT MAX(sortOrder) as maxSortOrder FROM account",
    [],
    "get",
  ) as { maxSortOrder: number };
  const sortOrder = row.maxSortOrder ? row.maxSortOrder + 1 : 0;

  // Insert it
  const accountUUID = crypto.randomUUID();
  const info: Sqlite3Info = exec(
    getMainDatabase(),
    "INSERT INTO account (sortOrder, uuid) VALUES (?, ?)",
    [sortOrder, accountUUID],
  ) as Sqlite3Info;

  // Return it
  const account = getAccount(info.lastInsertRowid);
  if (!account) {
    throw new Error("Failed to create account");
  }
  return account;
};

// Set account.type to type, create a new account of that type (right now, just xAccount), and return the account
export const selectAccountType = (accountID: number, type: string): Account => {
  // Get the account
  const account = getAccount(accountID);
  if (!account) {
    throw new Error("Account not found");
  }
  if (account.type != "unknown") {
    throw new Error("Account already has a type");
  }

  // Create the new account type
  switch (type) {
    case "X":
      account.xAccount = createXAccount();
      break;
    case "Bluesky":
      account.blueskyLocalAccount = createBlueskyLocalAccount(account.uuid);
      break;
    case "Facebook":
      account.facebookAccount = createFacebookAccount();
      break;
    default:
      throw new Error("Unknown account type");
  }

  const xAccountId = account.xAccount ? account.xAccount.id : null;
  const facebookAccountID = account.facebookAccount
    ? account.facebookAccount.id
    : null;

  // Update the account
  exec(
    getMainDatabase(),
    `
        UPDATE account
        SET
            type = ?,
            xAccountId = ?,
            facebookAccountID = ?
        WHERE id = ?
    `,
    [type, xAccountId, facebookAccountID, account.id],
  );

  account.type = type;
  return account;
};

// Update the account based on account.id
export const saveAccount = (account: Account) => {
  if (account.xAccount) {
    saveXAccount(account.xAccount);
  } else if (account.blueskyLocalAccount) {
    saveBlueskyLocalAccount(account.blueskyLocalAccount);
  } else if (account.facebookAccount) {
    saveFacebookAccount(account.facebookAccount);
  }

  exec(
    getMainDatabase(),
    `
        UPDATE account
        SET
            type = ?,
            sortOrder = ?
        WHERE id = ?
    `,
    [account.type, account.sortOrder, account.id],
  );
};

export const deleteAccount = (accountID: number, confirmationUuid?: string) => {
  // Get the account
  const account = getAccount(accountID);
  if (!account) {
    throw new Error("Account not found");
  }
  if (account.type === "Bluesky" && confirmationUuid !== account.uuid) {
    throw new Error("Bluesky local account deletion confirmation mismatch");
  }

  // Delete the account type
  switch (account.type) {
    case "X":
      if (account.xAccount) {
        exec(getMainDatabase(), "DELETE FROM xAccount WHERE id = ?", [
          account.xAccount.id,
        ]);
      }
      break;
    case "Bluesky":
      if (account.blueskyLocalAccount) {
        exec(
          getMainDatabase(),
          "DELETE FROM blueskyLocalAccount WHERE uuid = ?",
          [account.blueskyLocalAccount.uuid],
        );
      }
      break;
    case "Facebook":
      if (account.facebookAccount) {
        exec(getMainDatabase(), "DELETE FROM facebookAccount WHERE id = ?", [
          account.facebookAccount.id,
        ]);
      }
      break;
  }

  // Delete the account
  exec(getMainDatabase(), "DELETE FROM account WHERE id = ?", [accountID]);
};

// IPC

export const defineIPCDatabaseAccount = () => {
  ipcMain.handle(
    "database:getAccount",
    async (_, accountID): Promise<Account | null> => {
      try {
        return getAccount(accountID);
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );

  ipcMain.handle("database:getAccounts", async (_): Promise<Account[]> => {
    try {
      return getAccounts();
    } catch (error) {
      throw new Error(packageExceptionForReport(error as Error));
    }
  });

  ipcMain.handle("database:createAccount", async (_) => {
    try {
      return createAccount();
    } catch (error) {
      throw new Error(packageExceptionForReport(error as Error));
    }
  });

  ipcMain.handle("database:selectAccountType", async (_, accountID, type) => {
    try {
      return selectAccountType(accountID, type);
    } catch (error) {
      throw new Error(packageExceptionForReport(error as Error));
    }
  });

  ipcMain.handle("database:saveAccount", async (_, accountJson) => {
    try {
      const account = JSON.parse(accountJson);
      return saveAccount(account);
    } catch (error) {
      throw new Error(packageExceptionForReport(error as Error));
    }
  });

  ipcMain.handle(
    "database:deleteAccount",
    async (_, accountID, confirmationUuid?: string) => {
      try {
        const account = getAccount(accountID);
        if (account?.type === "Bluesky") {
          const ses = session.fromPartition(`persist:account-${accountID}`);
          const { BlueskyLocalAccountController } =
            await import("../account_bluesky/bluesky_account_controller");
          const controller = new BlueskyLocalAccountController(accountID, {
            delete: async () => {
              await ses.closeAllConnections();
              await ses.clearStorageData();
            },
          });
          controller.open();
          await controller.deleteConfirmed(confirmationUuid ?? "");
        } else {
          const ses = session.fromPartition(`persist:account-${accountID}`);
          await ses.closeAllConnections();
          await ses.clearStorageData();
          deleteAccount(accountID);
        }
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};
