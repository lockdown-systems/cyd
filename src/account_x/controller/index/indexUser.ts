import log from "electron-log/main";
import { exec } from "../../../database";
import { getImageDataURI } from "../../../shared/utils/image-utils";
import type { XAccountController } from "../../x_account_controller";
import type { XAPIUser, XUserRow } from "../../types";

/**
 * Index a user from the X API into the database.
 * This method handles both inserting new users and updating existing ones.
 */
export async function indexUser(
  controller: XAccountController,
  user: XAPIUser,
): Promise<void> {
  if (!controller.db) {
    controller.initDB();
  }

  log.debug("XAccountController.indexUser", user);

  // Download the profile image
  const profileImageDataURI = user.profile_image_url_https
    ? await getImageDataURI(user.profile_image_url_https)
    : "";

  // Have we seen this user before?
  const existing: XUserRow[] = exec(
    controller.db!,
    "SELECT * FROM user WHERE userID = ?",
    [user.id_str],
    "all",
  ) as XUserRow[];
  if (existing.length > 0) {
    // Update the user
    exec(
      controller.db!,
      "UPDATE user SET name = ?, screenName = ?, profileImageDataURI = ? WHERE userID = ?",
      [user.name, user.screen_name, profileImageDataURI, user.id_str],
    );
  } else {
    // Add the user
    exec(
      controller.db!,
      "INSERT INTO user (userID, name, screenName, profileImageDataURI) VALUES (?, ?, ?, ?)",
      [user.id_str, user.name, user.screen_name, profileImageDataURI],
    );
  }

  // Update progress
  if (existing.length == 0) {
    controller.progress.usersIndexed++;
  }
}
