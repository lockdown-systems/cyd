import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import UpdatesBar from "./UpdatesBar.vue";
import { UpdateStatus } from "../../types";
import { mockElectronAPI } from "../../test_util";
import i18n from "../../i18n";

const mountBar = (
  updateStatus: UpdateStatus = UpdateStatus.Unknown,
  platform: string = "linux",
) =>
  mount(UpdatesBar, {
    props: { updateStatus, platform },
    global: {
      plugins: [i18n],
    },
  });

const allStatuses = [
  UpdateStatus.Unknown,
  UpdateStatus.Error,
  UpdateStatus.Checking,
  UpdateStatus.Available,
  UpdateStatus.NotAvailable,
  UpdateStatus.Downloaded,
];

describe("UpdatesBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  it("shows the update message", () => {
    const wrapper = mountBar();

    expect(wrapper.find(".updates-bar").exists()).toBe(true);
    expect(wrapper.text()).toContain("Cyd update available.");
    expect(wrapper.text()).toContain(
      "You should always use the latest version of Cyd.",
    );
  });

  describe("dismissing", () => {
    it("hides the bar when the dismiss button is clicked", async () => {
      const wrapper = mountBar();

      (wrapper.find(".updates-bar-close").element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".updates-bar").exists()).toBe(false);
    });

    it("stays hidden when the update status changes", async () => {
      const wrapper = mountBar(UpdateStatus.Checking, "darwin");

      (wrapper.find(".updates-bar-close").element as HTMLElement).click();
      await wrapper.vm.$nextTick();
      await wrapper.setProps({ updateStatus: UpdateStatus.Downloaded });

      expect(wrapper.find(".updates-bar").exists()).toBe(false);
    });

    // Dismissing is unconditional: a bar the user closed stays closed even
    // when it's showing something actionable.
    it.each(allStatuses)(
      "offers a dismiss button in update status %i",
      (updateStatus) => {
        for (const platform of ["linux", "darwin", "win32"]) {
          const wrapper = mountBar(updateStatus, platform);
          expect(wrapper.find(".updates-bar-close").exists()).toBe(true);
        }
      },
    );
  });

  describe("on Linux", () => {
    it("points at the package manager and never offers a restart", () => {
      const wrapper = mountBar(UpdateStatus.Downloaded, "linux");

      expect(wrapper.text()).toContain(
        "Install updates using your operating system's package manager.",
      );
      expect(wrapper.find(".btn-primary").exists()).toBe(false);
    });
  });

  describe("on other platforms", () => {
    it("reports that it's checking", () => {
      expect(mountBar(UpdateStatus.Checking, "darwin").text()).toContain(
        "Loading update status...",
      );
    });

    it("reports that it's downloading", () => {
      expect(mountBar(UpdateStatus.Available, "darwin").text()).toContain(
        "Downloading update...",
      );
    });

    it("emits when the restart button is clicked", async () => {
      const wrapper = mountBar(UpdateStatus.Downloaded, "darwin");

      expect(wrapper.text()).toContain("Restart to Update");
      (wrapper.find(".btn-primary").element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("restartToUpdateClicked")).toBeTruthy();
    });

    it.each([UpdateStatus.Error, UpdateStatus.NotAvailable])(
      "falls back to the website in update status %i",
      async (updateStatus) => {
        const wrapper = mountBar(updateStatus, "win32");

        expect(wrapper.text()).toContain("Error with automatic update.");
        (wrapper.find("a").element as HTMLElement).click();
        await wrapper.vm.$nextTick();

        expect(window.electron.openURL).toHaveBeenCalledWith(
          "https://cyd.social/download/",
        );
      },
    );
  });
});
