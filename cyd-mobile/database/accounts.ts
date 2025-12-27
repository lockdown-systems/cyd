import type { SQLiteDatabase } from "expo-sqlite/next";

import { getDatabase } from "./index";

export type AccountListItem = {
  id: number;
  uuid: string;
  sortOrder: number | null;
  type: "bluesky";
  handle: string;
  displayName: string | null;
  avatarDataURI: string | null;
};

type CreateBlueskyAccountParams = {
  uuid?: string;
  sortOrder?: number | null;
  handle: string;
  displayName?: string | null;
  postsCount?: number;
  avatarDataURI?: string | null;
};

const DEV_SEED_ACCOUNTS: CreateBlueskyAccountParams[] = [
  {
    uuid: "acc-demo-1",
    handle: "nexamind-cyd.bsky.social",
    displayName: "Nexamind",
    avatarDataURI:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAAB8ESQZAAAAKUlEQVR4nO3MMQ0AIAgDQf//M2kYCRwYkpwN1F3T0zrg0g7T7NNsMIYQwkMAkf0Aw5TzfIMAAAAASUVORK5CYII=",
  },
  {
    uuid: "acc-demo-2",
    handle: "support-cyd.bsky.social",
    displayName: "Cyd Support",
    avatarDataURI:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAAB8ESQZAAAAL0lEQVR4nO3MMQ0AAAgDINc/9MYalKTBciyc2VXb3SJJkiRJkiRJkiQ5ZD4COr0F6jU8TDgAAAAASUVORK5CYII=",
  },
];

export async function listAccounts(): Promise<AccountListItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<
    AccountListItem & { bskyAccountID: number }
  >(
    `SELECT a.id, a.uuid, a.sortOrder, a.type, a.bskyAccountID, b.handle, b.displayName, b.avatarDataURI
     FROM account a
     INNER JOIN bsky_account b ON b.id = a.bskyAccountID
     ORDER BY a.sortOrder ASC, a.id ASC;`,
  );

  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    sortOrder: row.sortOrder,
    type: "bluesky",
    handle: row.handle,
    displayName: row.displayName,
    avatarDataURI: row.avatarDataURI ?? null,
  }));
}

export async function createBlueskyAccount(
  params: CreateBlueskyAccountParams,
): Promise<AccountListItem> {
  const db = await getDatabase();
  return createBlueskyAccountWithDb(db, params);
}

async function createBlueskyAccountWithDb(
  db: SQLiteDatabase,
  params: CreateBlueskyAccountParams,
): Promise<AccountListItem> {
  const now = Date.now();
  const postsCount = params.postsCount ?? 0;
  let createdAccount: AccountListItem | null = null;

  await db.withTransactionAsync(async () => {
    const bskyResult = await db.runAsync(
      `INSERT INTO bsky_account (
        createdAt,
        updatedAt,
        accessedAt,
        handle,
        displayName,
        postsCount,
        avatarDataURI
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        now,
        now,
        now,
        params.handle,
        params.displayName ?? null,
        postsCount,
        params.avatarDataURI ?? null,
      ],
    );

    const bskyAccountID = bskyResult.lastInsertRowId;
    const sortOrder = params.sortOrder ?? (await getNextSortOrder(db));
    const uuid = params.uuid ?? createUUID();

    const accountResult = await db.runAsync(
      `INSERT INTO account (uuid, sortOrder, type, bskyAccountID)
       VALUES (?, ?, 'bluesky', ?);`,
      [uuid, sortOrder ?? 0, bskyAccountID],
    );

    createdAccount = {
      id: accountResult.lastInsertRowId,
      uuid,
      sortOrder,
      type: "bluesky",
      handle: params.handle,
      displayName: params.displayName ?? null,
      avatarDataURI: params.avatarDataURI ?? null,
    };
  });

  if (!createdAccount) {
    throw new Error("Failed to create Bluesky account record");
  }

  return createdAccount;
}

async function getNextSortOrder(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ nextOrder: number }>(
    "SELECT COALESCE(MAX(sortOrder), -1) + 1 AS nextOrder FROM account;",
  );
  return row?.nextOrder ?? 0;
}

export async function ensureDevSeedData(): Promise<void> {
  if (!__DEV__) {
    return;
  }

  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(1) as count FROM account;",
  );

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  for (let index = 0; index < DEV_SEED_ACCOUNTS.length; index += 1) {
    const seed = DEV_SEED_ACCOUNTS[index];
    await createBlueskyAccountWithDb(db, {
      ...seed,
      sortOrder: index,
    });
  }
}

function createUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const random = Math.random().toString(16).slice(2, 12);
  return `uuid-${Date.now().toString(16)}-${random}`;
}
