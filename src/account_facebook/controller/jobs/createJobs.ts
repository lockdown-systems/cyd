import { exec } from "../../../database";
import type { FacebookAccountController } from "../../facebook_account_controller";
import type { FacebookJob } from "../../../shared_types";
import type { FacebookJobRow } from "../../types";

/**
 * Creates new pending jobs and cancels any existing pending jobs.
 * Returns the list of newly created pending jobs.
 */
export function createJobs(
  controller: FacebookAccountController,
  jobTypes: string[],
): FacebookJob[] {
  if (!controller.db) {
    controller.initDB();
  }

  // Cancel pending jobs
  exec(controller.db, "UPDATE job SET status = ? WHERE status = ?", [
    "canceled",
    "pending",
  ]);

  // Create new pending jobs
  jobTypes.forEach((jobType) => {
    exec(
      controller.db,
      "INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)",
      [jobType, "pending", new Date()],
    );
  });

  // Select pending jobs
  const jobs: FacebookJobRow[] = exec(
    controller.db,
    "SELECT * FROM job WHERE status = ? ORDER BY id",
    ["pending"],
    "all",
  ) as FacebookJobRow[];
  return jobs.map(controller.convertFacebookJobRowToFacebookJob);
}
