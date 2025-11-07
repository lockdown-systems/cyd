import fetch from "node-fetch";
import log from "electron-log/main";
import { saveXAccount } from "../../../database";
import type { XAccountController } from "../../x_account_controller";

/**
 * Downloads and saves a profile image from a URL to the account's profileImageDataURI.
 */
export async function saveProfileImage(
  controller: XAccountController,
  url: string,
): Promise<void> {
  try {
    const response = await fetch(url, {});
    if (!response.ok) {
      log.warn("saveProfileImage: response not ok", response.status);
      return;
    }
    const buffer = await response.buffer();
    const dataURI = `data:${response.headers.get("content-type")};base64,${buffer.toString("base64")}`;
    log.info("saveProfileImage: got profile image!");

    if (controller.account) {
      controller.account.profileImageDataURI = dataURI;
      saveXAccount(controller.account);
    }
  } catch {
    return;
  }
}
