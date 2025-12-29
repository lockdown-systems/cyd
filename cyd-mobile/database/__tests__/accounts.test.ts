import type { AppBskyActorDefs } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client";

import {
  createBlueskyAccount,
  listAccounts,
  saveAuthenticatedBlueskyAccount,
} from "../accounts";
import * as databaseModule from "../index";

// Mock the database module
jest.mock("../index", () => ({
  getDatabase: jest.fn(),
}));

const getDatabase = databaseModule.getDatabase as jest.Mock;

describe("Account Database Operations", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (callback) => await callback()),
    };
    getDatabase.mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listAccounts", () => {
    it("should return empty array when no accounts exist", async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const accounts = await listAccounts();

      expect(accounts).toEqual([]);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT a.id, a.uuid"),
      );
    });

    it("should return list of accounts ordered by sortOrder", async () => {
      const mockRows = [
        {
          id: 1,
          uuid: "uuid-1",
          sortOrder: 0,
          type: "bluesky",
          bskyAccountID: 10,
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatarDataURI: "data:image/png;base64,xyz",
          did: "did:plc:alice123",
        },
        {
          id: 2,
          uuid: "uuid-2",
          sortOrder: 1,
          type: "bluesky",
          bskyAccountID: 11,
          handle: "bob.bsky.social",
          displayName: "Bob",
          avatarDataURI: null,
          did: "did:plc:bob456",
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      const accounts = await listAccounts();

      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        id: 1,
        uuid: "uuid-1",
        sortOrder: 0,
        type: "bluesky",
        handle: "alice.bsky.social",
        displayName: "Alice",
        avatarDataURI: "data:image/png;base64,xyz",
        did: "did:plc:alice123",
      });
      expect(accounts[1].handle).toBe("bob.bsky.social");
    });

    it("should handle null values correctly", async () => {
      const mockRows = [
        {
          id: 1,
          uuid: "uuid-1",
          sortOrder: null,
          type: "bluesky",
          bskyAccountID: 10,
          handle: "test.bsky.social",
          displayName: null,
          avatarDataURI: null,
          did: null,
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(mockRows);

      const accounts = await listAccounts();

      expect(accounts[0].displayName).toBeNull();
      expect(accounts[0].avatarDataURI).toBeNull();
      expect(accounts[0].did).toBeNull();
    });
  });

  describe("createBlueskyAccount", () => {
    beforeEach(() => {
      mockDb.runAsync.mockResolvedValue({
        lastInsertRowId: 100,
        changes: 1,
      });
      mockDb.getFirstAsync.mockResolvedValue({ nextOrder: 0 });
    });

    it("should create a new Bluesky account with minimal params", async () => {
      const params = {
        handle: "newuser.bsky.social",
      };

      const account = await createBlueskyAccount(params);

      expect(account).toBeDefined();
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      // First call: insert into bsky_account
      expect(mockDb.runAsync).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO bsky_account"),
        expect.arrayContaining([
          expect.any(Number), // createdAt
          expect.any(Number), // updatedAt
          expect.any(Number), // accessedAt
          "newuser.bsky.social",
          null, // displayName
          0, // postsCount
          null, // avatarDataURI
          null, // did
          null, // accessJwt
          null, // refreshJwt
          null, // sessionJson
        ]),
      );

      // Second call: insert into account
      expect(mockDb.runAsync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO account"),
        [
          expect.any(String), // uuid (generated)
          0, // sortOrder
          100, // bskyAccountID
        ],
      );
    });

    it("should create account with all provided params", async () => {
      const params = {
        uuid: "custom-uuid",
        sortOrder: 5,
        did: "did:plc:test123",
        handle: "testuser.bsky.social",
        displayName: "Test User",
        postsCount: 42,
        avatarDataURI: "data:image/png;base64,abc",
        accessJwt: "access-token",
        refreshJwt: "refresh-token",
        sessionJson: '{"test":"data"}',
      };

      const account = await createBlueskyAccount(params);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO bsky_account"),
        expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          "testuser.bsky.social",
          "Test User",
          42,
          "data:image/png;base64,abc",
          "did:plc:test123",
          "access-token",
          "refresh-token",
          '{"test":"data"}',
        ]),
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO account"),
        expect.arrayContaining(["custom-uuid", 5, 100]),
      );
    });

    it("should use next sort order when not provided", async () => {
      mockDb.getFirstAsync.mockResolvedValue({ nextOrder: 3 });

      const account = await createBlueskyAccount({
        handle: "test.bsky.social",
      });

      expect(account).toBeDefined();
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining("MAX(sortOrder)"),
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO account"),
        expect.arrayContaining([expect.any(String), 3, 100]),
      );
    });

    it("should generate UUID when not provided", async () => {
      await createBlueskyAccount({ handle: "test.bsky.social" });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO account"),
        [
          expect.any(String), // UUID (generated, not necessarily starting with "uuid-")
          expect.any(Number), // sortOrder
          expect.any(Number), // bskyAccountID
        ],
      );
    });
  });

  describe("saveAuthenticatedBlueskyAccount", () => {
    const mockSession: OAuthSession = {
      did: "did:plc:test123",
    } as unknown as OAuthSession;

    const mockProfile: AppBskyActorDefs.ProfileViewDetailed = {
      did: "did:plc:test123",
      handle: "alice.bsky.social",
      displayName: "Alice",
      avatar: "https://example.com/avatar.jpg",
      postsCount: 100,
    } as AppBskyActorDefs.ProfileViewDetailed;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create new account when none exists", async () => {
      // Mock the sequence of database calls:
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // 1. Check for existing bsky_account by did/handle
        .mockResolvedValueOnce(null) // 2. Check for existing account by bskyAccountID
        .mockResolvedValueOnce({ nextOrder: 0 }) // 3. getNextSortOrder call
        .mockResolvedValueOnce({
          // 4. Final SELECT to get the created account
          id: 1,
          uuid: "new-uuid",
          sortOrder: 0,
          type: "bluesky",
          bskyAccountID: 200,
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatarDataURI: "https://example.com/avatar.jpg",
          did: "did:plc:test123",
        });

      mockDb.runAsync
        .mockResolvedValueOnce({ lastInsertRowId: 200, changes: 1 }) // Insert bsky_account
        .mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 }); // Insert account

      const account = await saveAuthenticatedBlueskyAccount({
        session: mockSession,
        profile: mockProfile,
      });

      expect(account.handle).toBe("alice.bsky.social");
      expect(account.displayName).toBe("Alice");
      expect(account.did).toBe("did:plc:test123");

      // Should have inserted into bsky_account
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO bsky_account"),
        expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          "alice.bsky.social",
          "Alice",
          100,
          "https://example.com/avatar.jpg",
          "did:plc:test123",
          null,
          null,
          expect.stringContaining('"did":"did:plc:test123"'),
        ]),
      );

      // Should have inserted into account
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO account"),
        expect.any(Array),
      );
    });

    it("should update existing account when found by did", async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ id: 50 }) // Existing bsky_account
        .mockResolvedValueOnce({ id: 25 }) // Existing account
        .mockResolvedValueOnce({
          // Final select
          id: 25,
          uuid: "existing-uuid",
          sortOrder: 0,
          type: "bluesky",
          bskyAccountID: 50,
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatarDataURI: "https://example.com/avatar.jpg",
          did: "did:plc:test123",
        });

      const account = await saveAuthenticatedBlueskyAccount({
        session: mockSession,
        profile: mockProfile,
      });

      expect(account.id).toBe(25);

      // Should have updated bsky_account
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE bsky_account"),
        expect.arrayContaining([
          "alice.bsky.social",
          "Alice",
          "https://example.com/avatar.jpg",
          expect.any(Number),
          expect.any(Number),
          100,
          "did:plc:test123",
          null,
          null,
          expect.any(String),
          50,
        ]),
      );

      // Should NOT have inserted into account (already exists)
      expect(mockDb.runAsync).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO account"),
        expect.any(Array),
      );
    });

    it("should handle profile without avatar", async () => {
      const profileNoAvatar: AppBskyActorDefs.ProfileViewDetailed = {
        ...mockProfile,
        avatar: undefined,
      };

      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // Check for existing bsky_account
        .mockResolvedValueOnce(null) // Check for existing account
        .mockResolvedValueOnce({ nextOrder: 0 }) // getNextSortOrder
        .mockResolvedValueOnce({
          // Final SELECT
          id: 1,
          uuid: "new-uuid",
          sortOrder: 0,
          type: "bluesky",
          bskyAccountID: 200,
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatarDataURI: null,
          did: "did:plc:test123",
        });

      mockDb.runAsync
        .mockResolvedValueOnce({ lastInsertRowId: 200, changes: 1 })
        .mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 });

      const account = await saveAuthenticatedBlueskyAccount({
        session: mockSession,
        profile: profileNoAvatar,
      });

      expect(account.avatarDataURI).toBeNull();
    });

    it("should serialize session as JSON", async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // Check for existing bsky_account
        .mockResolvedValueOnce(null) // Check for existing account
        .mockResolvedValueOnce({ nextOrder: 0 }) // getNextSortOrder
        .mockResolvedValueOnce({
          // Final SELECT
          id: 1,
          uuid: "new-uuid",
          sortOrder: 0,
          type: "bluesky",
          bskyAccountID: 200,
          handle: "alice.bsky.social",
          displayName: "Alice",
          avatarDataURI: null,
          did: "did:plc:test123",
        });

      mockDb.runAsync
        .mockResolvedValueOnce({ lastInsertRowId: 200, changes: 1 })
        .mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 });

      await saveAuthenticatedBlueskyAccount({
        session: mockSession,
        profile: mockProfile,
      });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO bsky_account"),
        expect.arrayContaining([
          expect.stringContaining('"did":"did:plc:test123"'),
        ]),
      );
    });
  });
});
