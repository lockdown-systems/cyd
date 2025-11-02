import log from "electron-log/main";
import Database from "better-sqlite3";
import { exec } from "../../database";
import { XAPIUser, XUserRow } from "../types";
import { XProgress } from "../../shared_types";

/**
 * Index a user from the X API into the database.
 * This method handles both inserting new users and updating existing ones.
 */
export async function indexUser(
  db: Database.Database,
  progress: XProgress,
  getImageDataURI: (url: string) => Promise<string>,
  user: XAPIUser,
): Promise<void> {
  log.debug("XAccountController.indexUser", user);

  // Download the profile image
  const profileImageDataURI = user.profile_image_url_https
    ? await getImageDataURI(user.profile_image_url_https)
    : "";

  // Have we seen this user before?
  const existing: XUserRow[] = exec(
    db,
    "SELECT * FROM user WHERE userID = ?",
    [user.id_str],
    "all",
  ) as XUserRow[];
  if (existing.length > 0) {
    // Update the user
    exec(
      db,
      "UPDATE user SET name = ?, screenName = ?, profileImageDataURI = ? WHERE userID = ?",
      [user.name, user.screen_name, profileImageDataURI, user.id_str],
    );
  } else {
    // Add the user
    exec(
      db,
      "INSERT INTO user (userID, name, screenName, profileImageDataURI) VALUES (?, ?, ?, ?)",
      [user.id_str, user.name, user.screen_name, profileImageDataURI],
    );
  }

  // Update progress
  if (existing.length == 0) {
    progress.usersIndexed++;
  }
}