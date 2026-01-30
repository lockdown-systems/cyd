import { exec } from "../../../database";
import type { FacebookAccountController } from "../../facebook_account_controller";
import type { FacebookJob } from "../../../shared_types";
import type { FacebookJobRow } from "../../types";

/**
 * Gets the last finished job of a specific type for the account.
 * Returns null if no finished job exists or if the account is not found.
 */
export async function getLastFinishedJob(
  controller: FacebookAccountController,
  jobType: string,
): Promise<FacebookJob | null> {
  if (!controller.account || !controller.account.username) {
    return null;
  }

  if (!controller.db) {
    controller.initDB();
  }

  const job: FacebookJobRow | null = exec(
    controller.db,
    "SELECT * FROM job WHERE jobType = ? AND status = ? AND finishedAt IS NOT NULL ORDER BY finishedAt DESC LIMIT 1",
    [jobType, "finished"],
    "get",
  ) as FacebookJobRow | null;
  if (job) {
    return controller.convertFacebookJobRowToFacebookJob(job);
  }
  return null;
}
