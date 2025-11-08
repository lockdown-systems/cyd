import path from "path";
import fs from "fs";
import { getAccountDataPath } from "../../../util";
import type { XAccountController } from "../../x_account_controller";

// Make sure the Archived Tweets folder exists and return its path
export async function archiveTweetsOutputPath(
  controller: XAccountController,
): Promise<string> {
  if (controller.account) {
    const accountDataPath = getAccountDataPath(
      "X",
      controller.account.username,
    );
    const outputPath = path.join(accountDataPath, "Archived Tweets");
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }
    return outputPath;
  }
  throw new Error("Account not found");
}
