import path from "path";
import unzipper from "unzipper";
import log from "electron-log/main";
import { getAccountDataPath } from "../../../util";
import type { XAccountController } from "../../x_account_controller";

/**
 * Unzips an X archive to the account's tmp directory.
 * Returns the unzipped path if successful, null otherwise.
 */
export async function unzipXArchive(
  controller: XAccountController,
  archiveZipPath: string,
): Promise<string | null> {
  if (!controller.db) {
    log.warn(`unzipXArchive: db does not exist, creating`);
    controller.initDB();
  }

  if (!controller.account) {
    log.warn(`unzipXArchive: account does not exist, bailing`);
    return null;
  }

  const unzippedPath = path.join(
    getAccountDataPath("X", controller.account.username),
    "tmp",
  );

  const archiveZip = await unzipper.Open.file(archiveZipPath);
  await archiveZip.extract({ path: unzippedPath });

  log.info(`unzipXArchive: unzipped to ${unzippedPath}`);

  return unzippedPath;
}
