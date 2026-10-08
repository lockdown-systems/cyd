import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import BlueskyWizardSave from "./BlueskyWizardSave.vue";
import { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import {
  mockElectronAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockEmitter,
} from "../../../test_util";
import type { BlueskyStoragePreflight } from "../../../../../shared_types";
import i18n from "../../../i18n";

/**
 * Choosing what to save. The only thing mocked is the controller boundary: the
 * page and the view model beneath it are real.
 */
function createModel(): BlueskyViewModel {
  const account = createMockAccount({
    id: 7,
    type: "Bluesky",
    uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
    xAccount: null,
    blueskyLocalAccount: createMockBlueskyLocalAccount({
      uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
      connectedAt: new Date(),
    }),
  });
  return new BlueskyViewModel(account, createMockEmitter());
}

const preflight = (
  overrides: Partial<BlueskyStoragePreflight> = {},
): BlueskyStoragePreflight => ({
  categories: [
    { category: "posts", recordCount: 120 },
    { category: "likes", recordCount: null },
  ],
  certainBytes: 200 * 1024 * 1024,
  estimatedBytes: 2 * 1024 * 1024 * 1024,
  availableBytes: 50 * 1024 * 1024 * 1024,
  uncertain: true,
  sufficiency: "uncertain",
  ...overrides,
});

function mountSave(model: BlueskyViewModel) {
  return mount(BlueskyWizardSave, {
    props: { model },
    global: { plugins: [i18n] },
  });
}

describe("BlueskyWizardSave", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("offers every category, each one on its own", () => {
    wrapper = mountSave(createModel());

    const labels = wrapper
      .findAll(".categories .form-check-label .category-title")
      .map((each) => each.text());
    expect(labels).toEqual(["Posts", "Reposts", "Likes", "Bookmarks"]);
  });

  it("cannot start until something is chosen", () => {
    wrapper = mountSave(createModel());

    expect(wrapper.find(".nothing-chosen").exists()).toBe(true);
    expect(wrapper.find(".start-saving").attributes("disabled")).toBeDefined();
  });

  it("turning a category on records it and asks what it needs on disk", async () => {
    const model = createModel();
    vi.mocked(window.electron.Bluesky.getCategorySettings).mockResolvedValue({
      posts: true,
      reposts: false,
      likes: false,
      bookmarks: false,
    });
    wrapper = mountSave(model);

    await wrapper.find("#bluesky-category-posts").setValue(true);
    await wrapper.vm.$nextTick();

    expect(window.electron.Bluesky.setCategoryEnabled).toHaveBeenCalledWith(
      7,
      "posts",
      true,
    );
    expect(window.electron.Bluesky.storagePreflight).toHaveBeenCalledWith(7, [
      "posts",
    ]);
  });

  it("shows the estimate, the certain part, the capacity, and the uncertainty", async () => {
    const model = createModel();
    model.categorySettings = {
      posts: true,
      reposts: false,
      likes: true,
      bookmarks: false,
    };
    model.preflight = preflight();
    wrapper = mountSave(model);

    const storage = wrapper.find(".storage").text();
    expect(storage).toContain("Estimated need: about 2.0 GB");
    expect(storage).toContain("Certain to need at least: 200 MB");
    expect(storage).toContain("Free space: 50 GB");

    const counts = wrapper
      .findAll(".storage .category-count")
      .map((each) => each.text());
    expect(counts[0]).toContain("Posts: about 120 records");
    expect(counts[1]).toContain("Bluesky publishes no count for Likes");

    expect(wrapper.find(".storage .uncertain").exists()).toBe(true);
    expect(wrapper.find(".storage .insufficient").exists()).toBe(false);
    expect(
      wrapper.find(".start-saving").attributes("disabled"),
    ).toBeUndefined();
  });

  it("an uncertain estimate does not stop a save", () => {
    const model = createModel();
    model.categorySettings = {
      posts: true,
      reposts: false,
      likes: false,
      bookmarks: false,
    };
    model.preflight = preflight({
      // The estimate is larger than what is free, but nothing is certain.
      estimatedBytes: 900 * 1024 * 1024 * 1024,
      sufficiency: "uncertain",
    });
    wrapper = mountSave(model);

    expect(
      wrapper.find(".start-saving").attributes("disabled"),
    ).toBeUndefined();
  });

  it("refuses to start when insufficiency is certain, and says why", () => {
    const model = createModel();
    model.categorySettings = {
      posts: true,
      reposts: false,
      likes: false,
      bookmarks: false,
    };
    model.preflight = preflight({
      certainBytes: 80 * 1024 * 1024 * 1024,
      availableBytes: 1024 * 1024,
      uncertain: false,
      sufficiency: "insufficient",
    });
    wrapper = mountSave(model);

    expect(wrapper.find(".storage .insufficient").text()).toContain(
      "isn't enough room",
    );
    expect(wrapper.find(".start-saving").attributes("disabled")).toBeDefined();
  });

  it("starting a save creates a job for each chosen category", async () => {
    const model = createModel();
    model.categorySettings = {
      posts: true,
      reposts: false,
      likes: true,
      bookmarks: false,
    };
    model.preflight = preflight();
    wrapper = mountSave(model);

    await wrapper.find(".start-saving").trigger("click");

    expect(window.electron.Bluesky.createJobs).toHaveBeenCalledWith(7, [
      "savePosts",
      "saveLikes",
    ]);
  });

  it("goes back to the dashboard", async () => {
    wrapper = mountSave(createModel());

    await wrapper.find(".back-to-dashboard").trigger("click");

    expect(wrapper.emitted("setState")).toEqual([["BlueskyWizardDashboard"]]);
  });
});
