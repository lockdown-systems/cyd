import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import XWizardSidebar from "./XWizardSidebar.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { Account, XAccount } from "../../../../../shared_types";
import { mockElectronAPI, createMockAccount } from "../../../test_util";

vi.mock("../../../util_x", () => ({
  xGetLastImportArchive: vi.fn(),
}));

interface MockEmitter {
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
}

describe("XWizardSidebar", () => {
  let wrapper: VueWrapper;
  let mockEmitter: MockEmitter;

  const createMockModel = (
    accountOverrides: Partial<Account> = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount(accountOverrides),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();

    mockEmitter = {
      on: vi.fn(),
      emit: vi.fn(),
    };

    // Mock getDatabaseStats
    vi.mocked(window.electron.X.getDatabaseStats).mockResolvedValue({
      tweetsSaved: 95,
      tweetsDeleted: 0,
      retweetsSaved: 20,
      retweetsDeleted: 0,
      likesSaved: 45,
      likesDeleted: 0,
      bookmarksSaved: 10,
      bookmarksDeleted: 0,
      conversationsDeleted: 5,
      accountsUnfollowed: 0,
      tweetsMigratedToBluesky: 0,
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("basic rendering", () => {
    it("should render sidebar with database stats", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      expect(wrapper.find(".wizard-sidebar").exists()).toBe(true);
      expect(window.electron.X.getDatabaseStats).toHaveBeenCalledWith(1);
    });

    it("should hide sidebar when shouldHideSidebar is true", async () => {
      const { xGetLastImportArchive } = await import("../../../util_x");
      vi.mocked(xGetLastImportArchive).mockResolvedValue(null);

      const mockModel = createMockModel({
        xAccount: {
          id: 1,
          tweetsCount: 100,
          likesCount: 50,
          followingCount: 200,
          followersCount: 300,
          archiveOnly: true,
        } as XAccount,
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find(".wizard-sidebar").exists()).toBe(false);
    });

    it("should show sidebar when archiveOnly but has lastImportArchive", async () => {
      const { xGetLastImportArchive } = await import("../../../util_x");
      vi.mocked(xGetLastImportArchive).mockResolvedValue(new Date());

      const mockModel = createMockModel({
        xAccount: {
          id: 1,
          tweetsCount: 100,
          likesCount: 50,
          followingCount: 200,
          followersCount: 300,
          archiveOnly: true,
        } as XAccount,
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      expect(wrapper.find(".wizard-sidebar").exists()).toBe(true);
    });
  });

  describe("stats display", () => {
    it("should display user stats when available", async () => {
      const mockModel = createMockModel({
        xAccount: {
          id: 1,
          tweetsCount: 1234,
          likesCount: 567,
          followingCount: 200,
          followersCount: 300,
          archiveOnly: false,
        } as XAccount,
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      const text = wrapper.text();
      expect(text).toContain("1,234");
      expect(text).toContain("567");
    });

    it("should show reload message when stats are unavailable", async () => {
      const mockModel = createMockModel({
        xAccount: {
          id: 1,
          tweetsCount: -1,
          likesCount: -1,
          followingCount: 200,
          followersCount: 300,
          archiveOnly: false,
        } as XAccount,
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      expect(wrapper.text()).toContain(
        "Cyd could not detect how many likes and tweets you have",
      );
      expect(wrapper.text()).toContain("Try again");
    });
  });

  describe("reload user stats", () => {
    it("should call setConfig and emit setState when reload link clicked", async () => {
      const mockModel = createMockModel({
        xAccount: {
          id: 1,
          tweetsCount: -1,
          likesCount: -1,
          followingCount: 200,
          followersCount: 300,
          archiveOnly: false,
        } as XAccount,
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      const reloadLink = wrapper.find("a");
      // Use click() directly instead of trigger()
      (reloadLink.element as HTMLAnchorElement).click();
      await nextTick();

      expect(window.electron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardPrestart]);
    });
  });

  describe("emitter events", () => {
    it("should register listener for database stats updates", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      expect(mockEmitter.on).toHaveBeenCalledWith(
        "x-update-database-stats-1",
        expect.any(Function),
      );
    });

    it("should register listener for account updates", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      expect(mockEmitter.on).toHaveBeenCalledWith(
        "account-updated",
        expect.any(Function),
      );
    });

    it("should update stats when emitter event fires", async () => {
      const mockModel = createMockModel();
      let statsUpdateCallback: (() => Promise<void>) | undefined;

      mockEmitter.on = vi.fn((event: string, callback: () => Promise<void>) => {
        if (event === "x-update-database-stats-1") {
          statsUpdateCallback = callback;
        }
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      // Update mock to return different stats
      vi.mocked(window.electron.X.getDatabaseStats).mockResolvedValue({
        tweetsSaved: 200,
        tweetsDeleted: 10,
        retweetsSaved: 40,
        retweetsDeleted: 5,
        likesSaved: 90,
        likesDeleted: 3,
        bookmarksSaved: 20,
        bookmarksDeleted: 2,
        conversationsDeleted: 10,
        accountsUnfollowed: 5,
        tweetsMigratedToBluesky: 15,
      });

      // Trigger the emitter callback
      if (statsUpdateCallback) {
        await statsUpdateCallback();
      }
      await nextTick();

      expect(window.electron.X.getDatabaseStats).toHaveBeenCalledTimes(2);
    });
  });

  describe("sidebar visibility logic", () => {
    it("should call updateSidebarVisibility on mount", async () => {
      const { xGetLastImportArchive } = await import("../../../util_x");
      const mockModel = createMockModel();

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      // Should be called during mount
      expect(xGetLastImportArchive).toHaveBeenCalledTimes(0); // Not archiveOnly, so not called
    });

    it("should check import archive when archiveOnly is true", async () => {
      const { xGetLastImportArchive } = await import("../../../util_x");
      vi.mocked(xGetLastImportArchive).mockResolvedValue(new Date());

      const mockModel = createMockModel({
        xAccount: {
          id: 1,
          tweetsCount: 100,
          likesCount: 50,
          followingCount: 200,
          followersCount: 300,
          archiveOnly: true,
        } as XAccount,
      });

      wrapper = mount(XWizardSidebar, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await nextTick();

      expect(xGetLastImportArchive).toHaveBeenCalledWith(1);
    });
  });
});
