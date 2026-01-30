import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import SidebarArchive from "./SidebarArchive.vue";
import { mockElectronAPI } from "../../test_util";
import type { ArchiveInfo } from "../../../../shared_types";

describe("SidebarArchive", () => {
  let mockArchiveGetInfo: ReturnType<typeof vi.fn>;
  let mockArchiveOpenFolder: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockArchiveGetInfo = vi.fn();
    mockArchiveOpenFolder = vi.fn();

    mockElectronAPI();

    // Override archive methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electron as any).archive = {
      getInfo: mockArchiveGetInfo,
      openFolder: mockArchiveOpenFolder,
    };
  });

  it("renders nothing when archive does not exist", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: true,
      indexHTMLExists: false,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 1,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("renders buttons when archive exists", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 1,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text()).toBe("Browse Archive");
    expect(buttons[1].text()).toBe("Open Folder");
  });

  it("calls getInfo on mount with correct accountID", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    mount(SidebarArchive, {
      props: {
        accountID: 42,
        accountType: "X",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockArchiveGetInfo).toHaveBeenCalledWith(42);
  });

  it("calls openFolder with index.html when Browse Archive is clicked", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 1,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const browseButton = wrapper.findAll("button")[0];
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    browseButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockArchiveOpenFolder).toHaveBeenCalledWith(1, "index.html");
  });

  it("calls openFolder with empty string when Open Folder is clicked", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 1,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const openFolderButton = wrapper.findAll("button")[1];
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    openFolderButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockArchiveOpenFolder).toHaveBeenCalledWith(1, "");
  });

  it("applies correct CSS classes to Browse Archive button", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 1,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const browseButton = wrapper.findAll("button")[0];
    expect(browseButton.classes()).toContain("btn");
    expect(browseButton.classes()).toContain("btn-outline-success");
    expect(browseButton.classes()).toContain("btn-sm");
  });

  it("applies correct CSS classes to Open Folder button", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 1,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const openFolderButton = wrapper.findAll("button")[1];
    expect(openFolderButton.classes()).toContain("btn");
    expect(openFolderButton.classes()).toContain("btn-outline-secondary");
    expect(openFolderButton.classes()).toContain("btn-sm");
  });

  it("works with different account types", async () => {
    const archiveInfo: ArchiveInfo = {
      folderEmpty: false,
      indexHTMLExists: true,
    };
    mockArchiveGetInfo.mockResolvedValue(archiveInfo);

    const wrapper = mount(SidebarArchive, {
      props: {
        accountID: 5,
        accountType: "X",
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockArchiveGetInfo).toHaveBeenCalledWith(5);
    expect(wrapper.findAll("button")).toHaveLength(2);
  });
});
