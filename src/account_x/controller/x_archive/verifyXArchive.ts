import path from "path";
import fs from "fs";
import log from "electron-log/main";
import { getAccountDataPath, getDataPath } from "../../../util";
import type { XAccountController } from "../../x_account_controller";
import type { XArchiveAccount } from "../../types";

/**
 * Verifies an X archive and handles archive-only account username updates.
 * Returns null on success, or an error message string on error.
 * Note: This function may modify the archivePath parameter internally, but the updated path is not returned.
 */
export async function verifyXArchive(
  controller: XAccountController,
  archivePath: string,
): Promise<string | null> {
  // If archivePath contains just one folder and no files, update archivePath to point to that inner folder
  const archiveContents = fs.readdirSync(archivePath);
  if (
    archiveContents.length === 1 &&
    fs.lstatSync(path.join(archivePath, archiveContents[0])).isDirectory()
  ) {
    archivePath = path.join(archivePath, archiveContents[0]);
  }

  const foldersToCheck = [archivePath, path.join(archivePath, "data")];

  // Make sure folders exist
  for (let i = 0; i < foldersToCheck.length; i++) {
    if (!fs.existsSync(foldersToCheck[i])) {
      log.error(`verifyXArchive: folder does not exist: ${foldersToCheck[i]}`);
      return `The folder ${foldersToCheck[i]} doesn't exist.`;
    }
  }

  // Make sure account.js exists and is readable
  const accountPath = path.join(archivePath, "data", "account.js");
  if (!fs.existsSync(accountPath)) {
    log.error(`verifyXArchive: file does not exist: ${accountPath}`);
    return `The file ${accountPath} doesn't exist.`;
  }
  try {
    fs.accessSync(accountPath, fs.constants.R_OK);
  } catch {
    log.error(`verifyXArchive: file is not readable: ${accountPath}`);
    return `The file ${accountPath} is not readable.`;
  }

  // Make sure the account.js file belongs to the right account
  let username;
  try {
    const accountFile = fs.readFileSync(accountPath, "utf8");
    const accountData: XArchiveAccount[] = JSON.parse(
      accountFile.slice("window.YTD.account.part0 = ".length),
    );
    if (accountData.length !== 1) {
      log.error(`verifyXArchive: account.js has more than one account`);
      return `The account.js file has more than one account.`;
    }

    // Store the username for later use
    username = accountData[0].account.username;

    // We run this check only if we're not in archive only mode
    if (
      username !== controller.account?.username &&
      !controller.account?.archiveOnly
    ) {
      log.info(`verifyXArchive: username: ${controller.account?.username}`);
      log.error(
        `verifyXArchive: account.js does not belong to the right account`,
      );
      return `This archive is for @${username}, not @${controller.account?.username}.`;
    }
  } catch {
    return "Error parsing JSON in account.js";
  }

  // If this is an archive-only account (which uses temporary usernames) and we now have the real username,
  // check if we need to rename the account directory or if it already exists with the correct name
  console.log(
    `verifyXArchive: archiveOnly: ${controller.account?.archiveOnly}`,
  );
  if (controller.account?.archiveOnly) {
    // Close the database before any directory operations
    if (controller.db) {
      controller.db.close();
      controller.db = null;
    }

    // `getAccountDataPath` creates the account data path if it doesn't exist
    const oldAccountDataPath = getAccountDataPath(
      "X",
      controller.account.username,
    );
    // We manually build the path here so that we can check if the folder exists
    const dataPath = getDataPath();
    const xDataPath = path.join(dataPath, "X");
    const newAccountDataPath = path.join(xDataPath, username);

    log.info(`verifyXArchive: oldAccountDataPath: ${oldAccountDataPath}`);
    log.info(`verifyXArchive: newAccountDataPath: ${newAccountDataPath}`);

    // Check if the folder already exists with the correct username
    if (fs.existsSync(newAccountDataPath)) {
      log.info(
        `verifyXArchive: Folder already exists with correct username, using existing folder: ${newAccountDataPath}`,
      );

      // Update the archivePath to point to the correct location in the existing folder
      // If archivePath was pointing to a tmp directory, update it to the new tmp directory
      const oldTmpPath = path.join(oldAccountDataPath, "tmp");

      log.info(`verifyXArchive: archivePath: ${archivePath}`);
      log.info(`verifyXArchive: oldTmpPath: ${oldTmpPath}`);
      log.info(
        `verifyXArchive: archivePath === oldTmpPath: ${archivePath === oldTmpPath}`,
      );

      // When using an existing folder, we need to copy the archive contents into the account's data directory
      // Create a tmp directory to hold the archive contents temporarily
      const tmpPath = path.join(newAccountDataPath, "tmp");
      if (!fs.existsSync(tmpPath)) {
        fs.mkdirSync(tmpPath, { recursive: true });
      }

      // Copy the archive contents to the tmp directory
      const copyRecursive = (src: string, dest: string) => {
        const items = fs.readdirSync(src);
        for (const item of items) {
          const srcPath = path.join(src, item);
          const destPath = path.join(dest, item);

          if (fs.lstatSync(srcPath).isDirectory()) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      // Copy the original archive contents to the tmp directory
      copyRecursive(archivePath, tmpPath);

      // Update archivePath to point to the tmp directory where we copied the contents
      archivePath = tmpPath;
      log.info(
        `verifyXArchive: Copied archive contents to tmp directory: ${archivePath}`,
      );

      // Update the account username in the database
      controller.account.username = username;
      await controller.updateAccountUsername(username);

      // Use the existing path
      controller.accountDataPath = newAccountDataPath;
      controller.initDB();

      controller.refreshAccount();
    } else {
      // Only rename if the new folder doesn't already exist
      // `getAccountDataPath` creates the account data path if it doesn't exist
      const newAccountDataPath = getAccountDataPath("X", username);
      try {
        // Move all content recursively from old directory to new directory
        if (fs.existsSync(oldAccountDataPath)) {
          const moveAllContent = (src: string, dest: string) => {
            const items = fs.readdirSync(src);
            for (const item of items) {
              const srcPath = path.join(src, item);
              const destPath = path.join(dest, item);

              if (fs.lstatSync(srcPath).isDirectory()) {
                if (!fs.existsSync(destPath)) {
                  fs.mkdirSync(destPath, { recursive: true });
                }
                moveAllContent(srcPath, destPath);
                fs.rmdirSync(srcPath); // Remove empty directory
              } else {
                fs.renameSync(srcPath, destPath);
              }
            }
          };

          moveAllContent(oldAccountDataPath, newAccountDataPath);
          log.info(
            `verifyXArchive: Moved all content from ${oldAccountDataPath} to ${newAccountDataPath}`,
          );

          // Update the archivePath to point to the new location
          const oldTmpPath = path.join(oldAccountDataPath, "tmp");
          const newTmpPath = path.join(newAccountDataPath, "tmp");
          if (archivePath === oldTmpPath) {
            archivePath = newTmpPath;
            log.info(
              `verifyXArchive: Updated archivePath from ${oldTmpPath} to ${newTmpPath}`,
            );
          }

          // Delete the old deleted_account_ folder after successful migration
          try {
            if (fs.existsSync(oldAccountDataPath)) {
              // Check if the directory is now empty (all content should have been moved)
              const remainingItems = fs.readdirSync(oldAccountDataPath);
              if (remainingItems.length === 0) {
                fs.rmdirSync(oldAccountDataPath);
                log.info(
                  `verifyXArchive: Deleted empty old directory: ${oldAccountDataPath}`,
                );
              } else {
                log.warn(
                  `verifyXArchive: Old directory not empty, skipping deletion: ${oldAccountDataPath} (${remainingItems.length} items remaining)`,
                );
              }
            }
          } catch (error) {
            log.error(
              `verifyXArchive: Failed to delete old directory ${oldAccountDataPath}: ${error}`,
            );
            // Don't fail the import if cleanup fails
          }
        }

        log.info(
          `verifyXArchive: Renamed account directory from ${controller.account.username} to ${username}`,
        );

        // Update the account username in the database
        controller.account.username = username;
        await controller.updateAccountUsername(username);

        // Reinitialize the database connection to point to the new path
        controller.accountDataPath = newAccountDataPath;
        controller.initDB();

        controller.refreshAccount();
      } catch (error) {
        log.error(
          `verifyXArchive: Failed to rename account directory: ${error}`,
        );
        // Continue with import even if rename fails
      }
    }
  }

  return null;
}
