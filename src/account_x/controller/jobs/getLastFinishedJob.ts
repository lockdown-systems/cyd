import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XJob } from "../../../shared_types";
import type { XJobRow } from "../../types";

/**
 * Gets the last finished job of a specific type for the account.
 * Returns null if no finished job exists or if the account is not found.
 */
export async function getLastFinishedJob(
    controller: XAccountController,
    jobType: string,
): Promise<XJob | null> {
    if (!controller.account || !controller.account.username) {
        return null;
    }

    if (!controller.db) {
        controller.initDB();
    }

    const job: XJobRow | null = exec(
        controller.db,
        "SELECT * FROM job WHERE jobType = ? AND status = ? AND finishedAt IS NOT NULL ORDER BY finishedAt DESC LIMIT 1",
        [jobType, "finished"],
        "get",
    ) as XJobRow | null;
    if (job) {
        return controller.convertXJobRowToXJob(job);
    }
    return null;
}

