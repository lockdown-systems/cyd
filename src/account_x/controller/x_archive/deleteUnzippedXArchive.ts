import fs from "fs";
import log from "electron-log/main";

/**
 * Deletes an unzipped X archive directory.
 */
export async function deleteUnzippedXArchive(
  archivePath: string,
): Promise<void> {
  fs.rm(archivePath, { recursive: true, force: true }, (err) => {
    if (err) {
      log.error(
        `deleteUnzippedXArchive: Error occured while deleting unzipped folder: ${err}`,
      );
    }
  });
}
