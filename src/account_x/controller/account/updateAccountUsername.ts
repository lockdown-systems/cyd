import { saveXAccount } from "../../../database";
import type { XAccountController } from "../../x_account_controller";

export async function updateAccountUsername(
  controller: XAccountController,
  newUsername: string,
): Promise<void> {
  // Update the username in the main database
  if (controller.account) {
    controller.account.username = newUsername;
    saveXAccount(controller.account);
  }
}
