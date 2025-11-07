import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XJob } from "../../../shared_types";
import type { XJobRow } from "../../types";

/**
 * Creates new pending jobs and cancels any existing pending jobs.
 * Returns the list of newly created pending jobs.
 */
export function createJobs(
  controller: XAccountController,
  jobTypes: string[],
): XJob[] {
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
  const jobs: XJobRow[] = exec(
    controller.db,
    "SELECT * FROM job WHERE status = ? ORDER BY id",
    ["pending"],
    "all",
  ) as XJobRow[];
  return jobs.map(controller.convertXJobRowToXJob);
}
