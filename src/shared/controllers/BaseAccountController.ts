import { session } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";
import { getAccount } from "../../database";
import { IMITMController } from "../../mitm";

export abstract class BaseAccountController {
    protected accountUUID: string = "";
    protected accountID: number = 0;
    protected accountDataPath: string = "";
    protected thereIsMore: boolean = false;

    // Making this public so it can be accessed in tests
    public db: Database.Database | null = null;
    public mitmController: IMITMController;

    protected cookies: Record<string, any> = {};

    constructor(accountID: number, mitmController: IMITMController) {
        this.mitmController = mitmController;
        this.accountID = accountID;
        this.refreshAccount();

        // Monitor web request metadata
        const ses = session.fromPartition(`persist:account-${this.accountID}`);
        ses.webRequest.onCompleted((_details) => {
            // TODO: Monitor for rate limits
        });

        ses.webRequest.onSendHeaders((details) => {
            this.handleCookieTracking(details);
        });
    }

    cleanup() {
        if (this.db) {
            this.db.pragma("wal_checkpoint(FULL)");
            this.db.close();
            this.db = null;
        }
    }

    protected abstract getAccountType(): string;
    protected abstract getAccountProperty(): any;
    protected abstract getAccountDataPath(): string;
    protected abstract handleCookieTracking(details: any): void;

    refreshAccount() {
        // Load the account
        const account = getAccount(this.accountID);
        if (!account) {
            log.error(
                `${this.constructor.name}.refreshAccount: account ${this.accountID} not found`,
            );
            return;
        }

        // Make sure it's the correct account type
        if (account.type !== this.getAccountType()) {
            log.error(
                `${this.constructor.name}.refreshAccount: account ${this.accountID} is not a ${this.getAccountType()} account`,
            );
            return;
        }

        // Get the account UUID
        this.accountUUID = account.uuid;
        log.debug(
            `${this.constructor.name}.refreshAccount: accountUUID=${this.accountUUID}`,
        );

        // Load the account-specific data
        const accountData = this.getAccountProperty();
        if (!accountData) {
            log.error(
                `${this.constructor.name}.refreshAccount: ${this.getAccountType()} account ${this.accountID} not found`,
            );
            return;
        }
    }

    initDB() {
        if (!this.accountDataPath) {
            log.error(`${this.constructor.name}.initDB: accountDataPath not set`);
            return;
        }

        log.info(`${this.constructor.name}.initDB: accountDataPath=${this.accountDataPath}`);

        // Open the database
        this.db = new Database(this.accountDataPath, {});
        this.db.pragma("journal_mode = WAL");
    }
}
