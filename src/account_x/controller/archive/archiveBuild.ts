import path from "path";
import fs from "fs";
import unzipper from "unzipper";
import { app } from "electron";
import log from "electron-log/main";
import { getResourcesPath, getAccountDataPath } from "../../../util";
import { saveArchive } from "../../archive";
import type { XAccountController } from "../../x_account_controller";

export async function archiveBuild(
  controller: XAccountController,
): Promise<boolean | void> {
  if (!controller.account) {
    console.error("XAccountController.archiveBuild: account not found");
    return false;
  }

  if (!controller.db) {
    controller.initDB();
    if (!controller.db) {
      console.error(
        "XAccountController.archiveBuild: database not initialized",
      );
      return;
    }
  }

  log.info("XAccountController.archiveBuild: building archive");

  // Build the archive
  const assetsPath = path.join(
    getAccountDataPath("X", controller.account.username),
    "assets",
  );
  if (!fs.existsSync(assetsPath)) {
    fs.mkdirSync(assetsPath);
  }
  const archivePath = path.join(assetsPath, "archive.js");
  saveArchive(
    controller.db!,
    app.getVersion(),
    controller.account.username,
    archivePath,
  );

  // Unzip x-archive.zip to the account data folder using unzipper
  const archiveZipPath = path.join(getResourcesPath(), "x-archive.zip");
  const archiveZip = await unzipper.Open.file(archiveZipPath);
  await archiveZip.extract({
    path: getAccountDataPath("X", controller.account.username),
  });
}
