import "../../__tests__/platform-fixtures/electronMocks";

import { describe, test, expect, afterEach } from "vitest";

import { createTestAccount } from "../../__tests__/platform-fixtures/accountFactory";
import {
  accountCredentialNamespace,
  listCredentialKeys,
  setCredential,
} from "../../credentials";
import { deleteAccount } from "../account";

describe("deleteAccount", () => {
  let cleanupAccount: (() => void) | null = null;

  afterEach(() => {
    cleanupAccount?.();
    cleanupAccount = null;
  });

  test("removes every credential the account persisted", () => {
    const { account, cleanup } = createTestAccount({
      type: "X",
      username: "credential-deletion-test",
    });
    cleanupAccount = cleanup;
    const namespace = accountCredentialNamespace(account.id);
    setCredential(namespace, "blueskySessionStore-did:web:cyd", "the-session");
    expect(listCredentialKeys(namespace)).toHaveLength(1);

    deleteAccount(account.id);

    expect(listCredentialKeys(namespace)).toEqual([]);
  });
});
