import { vi } from "vitest";

import { XAccountController } from "../../x_account_controller";
import type { Account } from "../../../shared_types";
import { createTestAccount } from "../../../__tests__/platform-fixtures/accountFactory";
import { XMockMITMController } from "./mockMitmController";

export interface XControllerTestContext {
  account: Account;
  controller: XAccountController;
  mitmController: XMockMITMController;
  cleanup(): void;
}

export const createXControllerTestContext = (
  username = "test",
): XControllerTestContext => {
  const mitmController = new XMockMITMController();
  const { account, cleanup: cleanupAccount } = createTestAccount({
    type: "X",
    username,
  });

  const controller = new XAccountController(account.id, mitmController);
  controller.saveTweetMedia = vi.fn();
  controller.initDB();

  return {
    account,
    controller,
    mitmController,
    cleanup: () => {
      controller.cleanup();
      cleanupAccount();
    },
  };
};
