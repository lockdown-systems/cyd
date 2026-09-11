import { ipcMain, session } from "electron";
import log from "electron-log/main";

import { exec, getMainDatabase, Sqlite3Info } from "./common";
import { createXAccount, getXAccount, saveXAccount } from "./x_account";
import {
  createBlueskyLocalAccount,
  deleteBlueskyLocalAccount,
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
import { removeBlueskyAccountStorage } from "../account_bluesky/storage";
import { accountCredentials } from "../credentials";

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
      // A Bluesky local account is keyed by the account's Cyd UUID, so there
      // is no separate link to follow.
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
    blueskyLocalAccount: blueskyLocalAccount,
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

export const deleteAccount = (
  accountID: number,
  confirmedAccountUUID?: string,
) => {
  // Get the account
  const account = getAccount(accountID);
  if (!account) {
    throw new Error("Account not found");
  }

  // Deleting a Bluesky local account destroys an irreplaceable local backup,
  // so every path into it must name the account it means to destroy.
  if (account.type === "Bluesky" && confirmedAccountUUID !== account.uuid) {
    throw new Error(
      "Deleting a Bluesky local account requires confirming its account UUID",
    );
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
      // A Bluesky local account owns a UUID-keyed directory holding its
      // connection material, runtime database, media, jobs, and staged work.
      // Deleting the account removes those local resources and nothing else.
      removeBlueskyAccountStorage(account.uuid);
      deleteBlueskyLocalAccount(account.uuid);
      break;
    case "Facebook":
      if (account.facebookAccount) {
        exec(getMainDatabase(), "DELETE FROM facebookAccount WHERE id = ?", [
          account.facebookAccount.id,
        ]);
      }
      break;
  }

  // Every credential an account persisted lives in the vault it owns, so
  // deleting the account leaves nothing behind that could still act on it.
  accountCredentials(accountID).deleteAll();

  // Delete the account
  exec(getMainDatabase(), "DELETE FROM account WHERE id = ?", [accountID]);
};

/**
 * Ask each platform to revoke whatever it authorized for this account.
 *
 * Revocation needs a platform controller and the network, so it is imported
 * lazily rather than dragging the account controllers into the database
 * layer. A platform that cannot reach its server must not block a deletion
 * the user asked for: the local credentials go either way.
 */
const revokeAccountConnections = async (accountID: number): Promise<void> => {
  try {
    const { revokeXBlueskyConnection } = await import("../account_x/ipc");
    await revokeXBlueskyConnection(accountID);
  } catch (error) {
    log.error(
      `revokeAccountConnections: could not revoke connections for account ${accountID}`,
      error,
    );
  }
};

/**
 * Release a deleted Bluesky local account's hold on its identity.
 *
 * This runs after the account row is gone, because who holds a Bluesky session
 * is derived from the accounts that exist: asking any earlier would still
 * count this one. An X account with the migration connected to the same
 * identity keeps its session and is not signed out.
 */
const releaseDeletedBlueskyHold = async (did: string): Promise<void> => {
  try {
    // Imported lazily: the shared OAuth module derives holders from this
    // module, so naming it at the top would close a cycle.
    const { releaseBlueskyHold } = await import("../bluesky_oauth");
    await releaseBlueskyHold(did);
  } catch (error) {
    log.error(
      "releaseDeletedBlueskyHold: could not release a deleted account's Bluesky hold",
      error,
    );
  }
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
    async (_, accountID, confirmedAccountUUID?: string) => {
      try {
        // A Bluesky local account holds its identity's shared session for as
        // long as it exists, so the identity is noted before it is destroyed.
        const account = getAccount(accountID);
        const blueskyDID =
          account?.type === "Bluesky"
            ? (account.blueskyLocalAccount?.did ?? null)
            : null;

        // Revoke before discarding: once the local credentials are gone, Cyd
        // can no longer tell the authorization server to invalidate them.
        await revokeAccountConnections(accountID);

        // Chromium holds this account's login cookies in its own persistent
        // partition, which is the credential store for X.
        const ses = session.fromPartition(`persist:account-${accountID}`);
        await ses.closeAllConnections();
        await ses.clearStorageData();
        deleteAccount(accountID, confirmedAccountUUID);

        if (blueskyDID) {
          await releaseDeletedBlueskyHold(blueskyDID);
        }
      } catch (error) {
        throw new Error(packageExceptionForReport(error as Error));
      }
    },
  );
};
