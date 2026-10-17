import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardDeleteOptionsPage from "./XWizardDeleteOptionsPage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";
import i18n from "../../../i18n";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  openURL: vi.fn(),
  setJobsType: vi.fn(),
}));

vi.mock("../../../util_x", async () => {
  const actual =
    await vi.importActual<typeof import("../../../util_x")>("../../../util_x");
  return {
    ...actual,
    xHasSomeData: vi.fn().mockResolvedValue(true),
  };
});

// Mock child components
vi.mock("../components/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
    template: "<div></div>",
  },
}));

vi.mock("../../shared_components/wizard/BaseWizardPage.vue", () => ({
  default: {
    name: "BaseWizardPage",
    template: '<div><slot name="content"></slot><slot></slot></div>',
    props: ["breadcrumbProps", "buttonProps"],
  },
}));

describe("XWizardDeleteOptionsPage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        deleteTweets: false,
        deleteRetweets: false,
        deleteLikes: false,
        deleteTweetsFilterEnabled: false,
        deleteTweetsFilterText: "",
        deleteRetweetsFilterEnabled: false,
        deleteRetweetsFilterText: "",
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should mount delete options page component", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should render BaseWizardPage wrapper", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.findComponent({ name: "BaseWizardPage" }).exists()).toBe(
        true,
      );
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardDashboard when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back"));

      if (backButton) {
        (backButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("setState")).toBeTruthy();
        expect(wrapper.emitted("setState")?.[0]).toEqual([
          State.WizardDashboard,
        ]);
      }
    });
  });

  describe("contains filter preview", () => {
    const mountWithFilter = async (attachTo?: HTMLElement) => {
      const mockModel = createMockModel({
        xAccount: { deleteTweets: true, deleteRetweets: true },
      });
      // The page loads its settings from the database, not from the model
      window.electron.database.getAccount = vi
        .fn()
        .mockResolvedValue(mockModel.account);
      wrapper = mount(XWizardDeleteOptionsPage, {
        props: { model: mockModel as XViewModel },
        global: { plugins: [i18n] },
        attachTo,
      });
      // Timers are faked in this block, so flush the mount's async work
      // by advancing the fake clock rather than sleeping for real
      await vi.advanceTimersByTimeAsync(50);
      await wrapper.vm.$nextTick();
      // Open the "more options" for tweets
      const showMore = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Show more options"));
      await showMore!.trigger("click");
      await wrapper.vm.$nextTick();
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      window.electron.X.getDeleteReviewStats = vi.fn().mockResolvedValue({
        tweetsToDelete: 59,
        retweetsToDelete: 3,
        likesToDelete: 0,
        bookmarksToDelete: 0,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows no preview until a filter term is typed", async () => {
      await mountWithFilter();

      expect(wrapper.find("#deleteTweetsFilterPreview").exists()).toBe(false);
      expect(window.electron.X.getDeleteReviewStats).not.toHaveBeenCalled();
    });

    it("saves the filter and shows the match count after typing", async () => {
      await mountWithFilter();

      await wrapper.find("#deleteTweetsFilterEnabled").setValue(true);
      const textInput = wrapper.find("#deleteTweetsFilterText");
      await textInput.setValue("@someone");
      await textInput.trigger("input");

      // Debounced: nothing fetched yet
      expect(window.electron.X.getDeleteReviewStats).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(500);
      await wrapper.vm.$nextTick();

      expect(window.electron.database.saveAccount).toHaveBeenCalled();
      const saved = JSON.parse(
        (window.electron.database.saveAccount as ReturnType<typeof vi.fn>).mock
          .calls[0][0],
      );
      expect(saved.xAccount.deleteTweetsFilterEnabled).toBe(true);
      expect(saved.xAccount.deleteTweetsFilterText).toBe("@someone");
      expect(window.electron.X.getDeleteReviewStats).toHaveBeenCalledTimes(1);

      const preview = wrapper.find("#deleteTweetsFilterPreview");
      expect(preview.exists()).toBe(true);
      expect(preview.text()).toContain("59 match");
    });

    const continueDisabled = () =>
      wrapper.findComponent({ name: "BaseWizardPage" }).props("buttonProps")
        .nextButtons[0].disabled;

    it("loads a saved filter that is ticked but empty as unticked", async () => {
      const mockModel = createMockModel({
        xAccount: {
          deleteTweets: true,
          deleteRetweets: true,
          deleteTweetsFilterEnabled: true,
          deleteTweetsFilterText: "",
          deleteRetweetsFilterEnabled: true,
          deleteRetweetsFilterText: "  ",
        },
      });
      window.electron.database.getAccount = vi
        .fn()
        .mockResolvedValue(mockModel.account);
      wrapper = mount(XWizardDeleteOptionsPage, {
        props: { model: mockModel as XViewModel },
        global: { plugins: [i18n] },
      });
      await vi.advanceTimersByTimeAsync(50);
      await wrapper.vm.$nextTick();

      // Both "more options" sections are closed, since no filter is active
      const showMoreButtons = wrapper
        .findAll("button")
        .filter((btn) => btn.text().includes("Show more options"));
      for (const btn of showMoreButtons) {
        await btn.trigger("click");
      }
      await wrapper.vm.$nextTick();

      expect(
        (wrapper.find("#deleteTweetsFilterEnabled").element as HTMLInputElement)
          .checked,
      ).toBe(false);
      expect(
        (
          wrapper.find("#deleteRetweetsFilterEnabled")
            .element as HTMLInputElement
        ).checked,
      ).toBe(false);
      expect(continueDisabled()).toBe(false);
    });

    it("blocks Continue while a ticked tweets filter has no text", async () => {
      await mountWithFilter();
      expect(continueDisabled()).toBe(false);

      await wrapper.find("#deleteTweetsFilterEnabled").setValue(true);
      expect(continueDisabled()).toBe(true);
      expect(wrapper.find("#deleteTweetsFilterMissing").exists()).toBe(true);

      await wrapper.find("#deleteTweetsFilterText").setValue("   ");
      expect(continueDisabled()).toBe(true);

      await wrapper.find("#deleteTweetsFilterText").setValue("@someone");
      expect(continueDisabled()).toBe(false);
      expect(wrapper.find("#deleteTweetsFilterMissing").exists()).toBe(false);
    });

    it("blocks Continue when a filter has too many wildcards", async () => {
      await mountWithFilter();
      await wrapper.find("#deleteTweetsFilterEnabled").setValue(true);

      await wrapper.find("#deleteTweetsFilterText").setValue("a*b*c*d*e");
      expect(continueDisabled()).toBe(true);
      expect(wrapper.find("#deleteTweetsFilterTooManyWildcards").exists()).toBe(
        true,
      );
      expect(wrapper.find("#deleteTweetsFilterPreview").exists()).toBe(false);

      // Stars in a row count once
      await wrapper.find("#deleteTweetsFilterText").setValue("a***b*c*d");
      expect(continueDisabled()).toBe(false);
      expect(wrapper.find("#deleteTweetsFilterTooManyWildcards").exists()).toBe(
        false,
      );
    });

    it("unticks the filter when its text is cleared", async () => {
      await mountWithFilter();
      const checkbox = wrapper.find("#deleteTweetsFilterEnabled");
      const text = wrapper.find("#deleteTweetsFilterText");

      await checkbox.setValue(true);
      await text.setValue("@someone");
      expect((checkbox.element as HTMLInputElement).checked).toBe(true);

      await text.setValue("");
      expect((checkbox.element as HTMLInputElement).checked).toBe(false);
      expect(continueDisabled()).toBe(false);
    });

    it("puts the cursor in the text box when the filter is ticked", async () => {
      const root = document.createElement("div");
      document.body.appendChild(root);
      try {
        await mountWithFilter(root);
        await wrapper.find("#deleteTweetsFilterEnabled").setValue(true);
        await wrapper.vm.$nextTick();

        expect(document.activeElement?.id).toBe("deleteTweetsFilterText");
      } finally {
        wrapper.unmount();
        root.remove();
      }
    });

    it("lets Continue through again when the empty filter is unticked", async () => {
      await mountWithFilter();

      await wrapper.find("#deleteTweetsFilterEnabled").setValue(true);
      expect(continueDisabled()).toBe(true);

      await wrapper.find("#deleteTweetsFilterEnabled").setValue(false);
      expect(continueDisabled()).toBe(false);
    });

    it("blocks Continue while a ticked retweets filter has no text", async () => {
      await mountWithFilter();
      const showMoreButtons = wrapper
        .findAll("button")
        .filter((btn) => btn.text().includes("Show more options"));
      await showMoreButtons[0].trigger("click");
      await wrapper.vm.$nextTick();

      await wrapper.find("#deleteRetweetsFilterEnabled").setValue(true);
      expect(continueDisabled()).toBe(true);
      expect(wrapper.find("#deleteRetweetsFilterMissing").exists()).toBe(true);

      await wrapper.find("#deleteRetweetsFilterText").setValue("#hashtag");
      expect(continueDisabled()).toBe(false);
    });

    it("only fetches once for a burst of keystrokes", async () => {
      await mountWithFilter();

      await wrapper.find("#deleteTweetsFilterEnabled").setValue(true);
      const textInput = wrapper.find("#deleteTweetsFilterText");
      for (const value of ["@", "@s", "@so"]) {
        await textInput.setValue(value);
        await textInput.trigger("input");
        await vi.advanceTimersByTimeAsync(100);
      }
      await vi.advanceTimersByTimeAsync(500);

      expect(window.electron.X.getDeleteReviewStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("data loading", () => {
    it("should check for existing data on mount", async () => {
      const { xHasSomeData } = await import("../../../util_x");

      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(xHasSomeData).toHaveBeenCalledWith(expect.any(Number));
    });
  });
});
