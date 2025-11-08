import crypto from "crypto";
import log from "electron-log/main";
import { saveXAccount } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XAccount } from "../../../shared_types";

// Set archiveOnly to true, and set a temporary username
export async function initArchiveOnlyMode(
  controller: XAccountController,
): Promise<XAccount> {
  if (!controller.account) {
    log.warn(
      `XAccountController.initArchiveOnlyMode: account does not exist, bailing`,
    );
    throw new Error("Account not found");
  }

  if (!controller.account.username) {
    const uuid = crypto.randomUUID();
    const tempUsername = `deleted_account_${uuid.slice(0, 8)}`;
    controller.account.username = tempUsername;
    log.info(
      "XAccountController.initArchiveOnlyMode: temporary username: ",
      tempUsername,
    );
  }

  controller.account.archiveOnly = true;
  saveXAccount(controller.account);

  return controller.account;
}
