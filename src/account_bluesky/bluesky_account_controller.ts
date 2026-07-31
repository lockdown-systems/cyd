import fs from "fs";
import path from "path";
import { createHash } from "crypto";

import Database from "better-sqlite3";

import {
  deleteAccount,
  getAccount,
  runMigrations,
  saveBlueskyLocalAccount,
} from "../database";
import type { BlueskyLocalAccount } from "../shared_types";
import { getDataPath } from "../util";

export interface BlueskyLocalAccountPaths {
  root: string;
  database: string;
  media: string;
  staging: string;
}

export type BlueskyProfileUpdate = Partial<
  Pick<BlueskyLocalAccount, "handle" | "displayName" | "avatarUrl">
>;

export interface BlueskyJobState {
  id: string;
  jobType: string;
  status: string;
  progress: unknown;
}

export interface BlueskyConnectionStore {
  delete(uuid: string): Promise<void>;
}

const runtimeMigrations = [
  {
    name: "initial Bluesky runtime storage",
    sql: [
      `CREATE TABLE job (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    state TEXT NOT NULL,
    progressJson TEXT NOT NULL DEFAULT '{}',
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
    ],
  },
];

const ensurePrivateDirectory = (directory: string): void => {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
};

export class BlueskyLocalAccountController {
  public account!: BlueskyLocalAccount;
  public paths!: BlueskyLocalAccountPaths;
  private db: Database.Database | null = null;

  constructor(
    private readonly accountID: number,
    private readonly connectionStore?: BlueskyConnectionStore,
  ) {}

  open(): void {
    const account = getAccount(this.accountID);
    if (
      !account ||
      account.type !== "Bluesky" ||
      !account.blueskyLocalAccount
    ) {
      throw new Error(`Bluesky local account ${this.accountID} not found`);
    }
    this.account = account.blueskyLocalAccount;

    const root = path.join(getDataPath(), "Bluesky", account.uuid);
    this.paths = {
      root,
      database: path.join(root, "runtime.sqlite3"),
      media: path.join(root, "media", "sha256"),
      staging: path.join(root, "staging"),
    };
    ensurePrivateDirectory(this.paths.root);
    ensurePrivateDirectory(this.paths.media);
    ensurePrivateDirectory(this.paths.staging);

    this.db = new Database(this.paths.database);
    fs.chmodSync(this.paths.database, 0o600);
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, runtimeMigrations);
  }

  bindDid(did: string): void {
    this.assertOpen();
    const updatedAccount = { ...this.account, did };
    saveBlueskyLocalAccount(updatedAccount);
    this.account = updatedAccount;
  }

  updateProfile(update: BlueskyProfileUpdate): void {
    this.assertOpen();
    const updatedAccount = { ...this.account, ...update };
    saveBlueskyLocalAccount(updatedAccount);
    this.account = updatedAccount;
  }

  storeMedia(content: Buffer): { digest: string; path: string } {
    this.assertOpen();
    const digest = createHash("sha256").update(content).digest("hex");
    const mediaPath = path.join(this.paths.media, digest);
    try {
      fs.writeFileSync(mediaPath, content, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    fs.chmodSync(mediaPath, 0o600);
    return { digest, path: mediaPath };
  }

  saveJobState(job: BlueskyJobState): void {
    this.assertOpen();
    this.db!.prepare(
      `INSERT INTO job (id, type, state, progressJson)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           state = excluded.state,
           progressJson = excluded.progressJson,
           updatedAt = CURRENT_TIMESTAMP`,
    ).run(job.id, job.jobType, job.status, JSON.stringify(job.progress));
  }

  getJobState(id: string): BlueskyJobState | null {
    this.assertOpen();
    const row = this.db!.prepare(
      "SELECT id, type, state, progressJson FROM job WHERE id = ?",
    ).get(id) as
      | { id: string; type: string; state: string; progressJson: string }
      | undefined;
    return row
      ? {
          id: row.id,
          jobType: row.type,
          status: row.state,
          progress: JSON.parse(row.progressJson),
        }
      : null;
  }

  async deleteConfirmed(confirmationUuid: string): Promise<void> {
    this.assertOpen();
    if (confirmationUuid !== this.account.uuid) {
      throw new Error("Bluesky local account deletion confirmation mismatch");
    }
    if (!this.connectionStore) {
      throw new Error("A Bluesky connection store is required for deletion");
    }

    await this.connectionStore.delete(this.account.uuid);
    this.close();
    fs.rmSync(this.paths.root, { recursive: true, force: true });
    deleteAccount(this.accountID, confirmationUuid);
  }

  close(): void {
    if (this.db) {
      this.db.pragma("wal_checkpoint(FULL)");
      this.db.close();
      this.db = null;
    }
  }

  private assertOpen(): void {
    if (!this.db) {
      throw new Error("Bluesky local account is not open");
    }
  }
}
