import type { AppBskyActorDefs } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client";
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
  did: string | null;
};

type CreateBlueskyAccountParams = {
  uuid?: string;
  sortOrder?: number | null;
  did?: string | null;
  handle: string;
  displayName?: string | null;
  postsCount?: number;
  avatarDataURI?: string | null;
  accessJwt?: string | null;
  refreshJwt?: string | null;
  sessionJson?: string | null;
};

export async function listAccounts(): Promise<AccountListItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<
    AccountListItem & { bskyAccountID: number }
  >(
    `SELECT a.id, a.uuid, a.sortOrder, a.type, a.bskyAccountID, b.handle, b.displayName, b.avatarDataURI, b.did
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
    did: row.did ?? null,
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
        avatarDataURI,
        did,
        accessJwt,
        refreshJwt,
        sessionJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        now,
        now,
        now,
        params.handle,
        params.displayName ?? null,
        postsCount,
        params.avatarDataURI ?? null,
        params.did ?? null,
        params.accessJwt ?? null,
        params.refreshJwt ?? null,
        params.sessionJson ?? null,
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
      did: params.did ?? null,
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

export async function saveAuthenticatedBlueskyAccount(params: {
  session: OAuthSession;
  profile: AppBskyActorDefs.ProfileViewDetailed;
}): Promise<AccountListItem> {
  const db = await getDatabase();
  const now = Date.now();
  const { session, profile } = params;
  let savedAccount: AccountListItem | null = null;

  await db.withTransactionAsync(async () => {
    const sessionJson = JSON.stringify(session);
    const avatar = profile.avatar ?? null;
    const displayName = profile.displayName ?? null;
    const persistedAccessJwt: string | null = null;
    const persistedRefreshJwt: string | null = null;

    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM bsky_account WHERE did = ? OR handle = ? LIMIT 1;`,
      [session.did, profile.handle],
    );

    let bskyAccountID: number;
    if (existing) {
      await db.runAsync(
        `UPDATE bsky_account
         SET handle = ?,
             displayName = ?,
             avatarDataURI = ?,
             updatedAt = ?,
             accessedAt = ?,
             postsCount = ?,
             did = ?,
             accessJwt = ?,
             refreshJwt = ?,
             sessionJson = ?
         WHERE id = ?;`,
        [
          profile.handle,
          displayName,
          avatar,
          now,
          now,
          profile.postsCount ?? 0,
          session.did,
          persistedAccessJwt,
          persistedRefreshJwt,
          sessionJson,
          existing.id,
        ],
      );
      bskyAccountID = existing.id;
    } else {
      const insert = await db.runAsync(
        `INSERT INTO bsky_account (
          createdAt,
          updatedAt,
          accessedAt,
          handle,
          displayName,
          postsCount,
          avatarDataURI,
          did,
          accessJwt,
          refreshJwt,
          sessionJson
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          now,
          now,
          now,
          profile.handle,
          displayName,
          profile.postsCount ?? 0,
          avatar,
          session.did,
          persistedAccessJwt,
          persistedRefreshJwt,
          sessionJson,
        ],
      );
      bskyAccountID = insert.lastInsertRowId;
    }

    const existingAccount = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM account WHERE bskyAccountID = ?;`,
      [bskyAccountID],
    );

    if (!existingAccount) {
      const sortOrder = await getNextSortOrder(db);
      await db.runAsync(
        `INSERT INTO account (uuid, sortOrder, type, bskyAccountID)
         VALUES (?, ?, 'bluesky', ?);`,
        [createUUID(), sortOrder, bskyAccountID],
      );
    }

    const row = await db.getFirstAsync<
      AccountListItem & { bskyAccountID: number }
    >(
      `SELECT a.id, a.uuid, a.sortOrder, a.type, a.bskyAccountID, b.handle, b.displayName, b.avatarDataURI, b.did
       FROM account a
       INNER JOIN bsky_account b ON b.id = a.bskyAccountID
       WHERE b.id = ?
       LIMIT 1;`,
      [bskyAccountID],
    );

    if (!row) {
      throw new Error("Failed to fetch saved Bluesky account record");
    }

    savedAccount = {
      id: row.id,
      uuid: row.uuid,
      sortOrder: row.sortOrder,
      type: "bluesky",
      handle: row.handle,
      displayName: row.displayName,
      avatarDataURI: row.avatarDataURI ?? null,
      did: row.did ?? null,
    };
  });

  if (!savedAccount) {
    throw new Error("Unable to persist Bluesky account");
  }

  return savedAccount;
}

function createUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const random = Math.random().toString(16).slice(2, 12);
  return `uuid-${Date.now().toString(16)}-${random}`;
}
