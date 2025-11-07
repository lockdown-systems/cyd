import type { XViewModel } from "../view_model";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";

/**
 * Get the ct0 cookie required for GraphQL mutations
 * @returns The ct0 cookie value, or null if not found
 */
export async function deleteContentGetCookie(
  vm: XViewModel,
  errorType: AutomationErrorType,
): Promise<string | null> {
  const ct0: string | null = await window.electron.X.getCookie(
    vm.account.id,
    "x.com",
    "ct0",
  );

  vm.log("deleteContentGetCookie", ["ct0", ct0]);

  if (!ct0) {
    await vm.error(errorType, {});
    return null;
  }

  return ct0;
}

/**
 * Execute a delete operation with retry logic and rate limit handling
 * @returns Object with success flag and final status code
 */
export async function deleteContentRetryLoop(
  vm: XViewModel,
  deleteFunction: () => Promise<number>,
): Promise<{ success: boolean; statusCode: number }> {
  let success = false;
  let statusCode = 0;

  for (let tries = 0; tries < 3; tries++) {
    statusCode = await deleteFunction();

    if (statusCode === 200) {
      success = true;
      break;
    } else if (statusCode === 429) {
      // Rate limited
      vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
      await vm.waitForRateLimit();
      tries = 0; // Reset tries after rate limit
    } else {
      // Sleep 1 second and try again
      vm.log("deleteContentRetryLoop", [
        "statusCode",
        statusCode,
        "failed to delete, try #",
        tries,
      ]);
      await vm.sleep(1000);
    }
  }

  return { success, statusCode };
}

/**
 * Update database after successful deletion
 * @returns true if update succeeded, false if error occurred
 */
export async function deleteContentUpdateDatabase(
  vm: XViewModel,
  updateFunction: () => Promise<void>,
  errorType: AutomationErrorType,
  itemData: unknown,
  index: number,
): Promise<boolean> {
  try {
    await updateFunction();
    return true;
  } catch (e) {
    await vm.error(
      errorType,
      {
        error: formatError(e as Error),
      },
      {
        item: itemData,
        index: index,
      },
      true,
    );
    return false;
  }
}

/**
 * Handle failed deletion by logging error and updating error count
 */
export async function deleteContentHandleFailure(
  vm: XViewModel,
  errorType: AutomationErrorType,
  statusCode: number,
  itemData: unknown,
  index: number,
): Promise<void> {
  await vm.error(
    errorType,
    {
      statusCode: statusCode,
    },
    {
      item: itemData,
      index: index,
    },
    true,
  );

  vm.progress.errorsOccured += 1;
  await vm.syncProgress();
}
