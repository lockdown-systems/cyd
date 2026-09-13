import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import BlueskyWizardBrowse from "./BlueskyWizardBrowse.vue";
import { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import {
  mockElectronAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockEmitter,
} from "../../../test_util";
import type {
  BlueskyAsset,
  BlueskyBrowsePage,
  BlueskySavedRecord,
} from "../../../../../shared_types";
import i18n from "../../../i18n";

/**
 * Reading Bluesky saved data. Only the controller boundary is mocked, and it is
 * the only thing the page talks to: there is no connection and no network here,
 * which is the point.
 */
function createModel(): BlueskyViewModel {
  const account = createMockAccount({
    id: 7,
    type: "Bluesky",
    uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
    xAccount: null,
    // Disconnected on purpose: browsing does not need an authorization.
    blueskyLocalAccount: createMockBlueskyLocalAccount({
      uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
      connectedAt: null,
    }),
  });
  return new BlueskyViewModel(account, createMockEmitter());
}

const availableAsset = (
  overrides: Partial<BlueskyAsset> = {},
): BlueskyAsset => ({
  id: "asset-image",
  kind: "image",
  mediaType: "image/jpeg",
  availability: "available",
  unavailableReason: null,
  byteCount: 1024,
  digest: "digest-image",
  width: 800,
  height: 600,
  altText: "my picture",
  ...overrides,
});

const savedPost = (
  overrides: Partial<BlueskySavedRecord> = {},
): BlueskySavedRecord => ({
  uri: "at://did:plc:examplealice/app.bsky.feed.post/withimage",
  recordType: "app.bsky.feed.post",
  cid: "bafypost",
  indexedAt: null,
  firstObservedAt: "2026-01-10T00:00:00.000Z",
  observedAt: "2026-01-10T00:00:00.000Z",
  createdAt: "2026-01-01T10:00:00.000Z",
  text: "A post with a picture",
  sourceDeletedAt: null,
  author: {
    profileID: "profile-alice",
    did: "did:plc:examplealice",
    handle: "alice.test",
    displayName: "Alice",
    avatar: null,
  },
  assets: [availableAsset()],
  subject: null,
  context: [],
  sourceURL: "https://bsky.app/profile/did:plc:examplealice/post/withimage",
  ...overrides,
});

const browsePage = (
  overrides: Partial<BlueskyBrowsePage> = {},
): BlueskyBrowsePage => ({
  category: "posts",
  records: [savedPost()],
  nextCursor: null,
  totalRecords: 1,
  ...overrides,
});

function mountBrowse(model: BlueskyViewModel) {
  return mount(BlueskyWizardBrowse, {
    props: { model },
    global: { plugins: [i18n] },
  });
}

describe("BlueskyWizardBrowse", () => {
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

  it("gives every category its own view, with what it has saved", () => {
    const model = createModel();
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 3,
          assetsExpected: 4,
          assetsAvailable: 4,
        },
        {
          category: "reposts",
          recordCount: 2,
          assetsExpected: 0,
          assetsAvailable: 0,
        },
        {
          category: "likes",
          recordCount: 1,
          assetsExpected: 2,
          assetsAvailable: 2,
        },
        {
          category: "bookmarks",
          recordCount: 0,
          assetsExpected: 0,
          assetsAvailable: 0,
        },
      ],
      complete: true,
    };
    model.browsePage = browsePage();
    wrapper = mountBrowse(model);

    const tabs = wrapper.findAll(".category-tab").map((tab) => tab.text());
    expect(tabs).toEqual(["Posts 3", "Reposts 2", "Likes 1", "Bookmarks 0"]);
  });

  it("renders a saved record from this computer, with no network", () => {
    const model = createModel();
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 1,
          assetsExpected: 1,
          assetsAvailable: 1,
        },
      ],
      complete: true,
    };
    model.browsePage = browsePage();
    model.browseMediaPaths = { "digest-image": "/tmp/media/digest-image" };
    wrapper = mountBrowse(model);

    const record = wrapper.find(".bluesky-record");
    expect(record.find(".record-text").text()).toBe("A post with a picture");
    expect(record.find(".author").text()).toBe("alice.test");
    expect(record.find("img.asset").attributes("src")).toBe(
      "file:///tmp/media/digest-image",
    );
    expect(record.find(".source-link").text()).toBe("View on Bluesky");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows media that is not here as absent, with the reason", () => {
    const model = createModel();
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 1,
          assetsExpected: 1,
          assetsAvailable: 0,
        },
      ],
      complete: false,
    };
    model.browsePage = browsePage({
      records: [
        savedPost({
          assets: [
            availableAsset({
              availability: "unavailable",
              unavailableReason: "Bluesky no longer has this asset",
              digest: null,
              byteCount: null,
            }),
          ],
        }),
      ],
    });
    wrapper = mountBrowse(model);

    expect(wrapper.find(".bluesky-record img.asset").exists()).toBe(false);
    expect(wrapper.find(".asset-unavailable").text()).toContain(
      "Bluesky no longer has this asset",
    );
    expect(wrapper.find(".incomplete").text()).toContain(
      "0 of 1 media files are here",
    );
  });

  it("shows a relationship as the record it is about", () => {
    const model = createModel();
    model.browseCategory = "likes";
    model.savedData = {
      categories: [
        {
          category: "likes",
          recordCount: 1,
          assetsExpected: 0,
          assetsAvailable: 0,
        },
      ],
      complete: true,
    };
    model.browsePage = browsePage({
      category: "likes",
      records: [
        savedPost({
          uri: "at://did:plc:examplealice/app.bsky.feed.like/one",
          recordType: "app.bsky.feed.like",
          text: null,
          assets: [],
          subject: {
            uri: "at://did:plc:examplebob/app.bsky.feed.post/liked",
            recordType: "app.bsky.feed.post",
            author: {
              profileID: "profile-bob",
              did: "did:plc:examplebob",
              handle: "bob.test",
              displayName: "Bob",
              avatar: null,
            },
            createdAt: "2026-01-05T09:00:00.000Z",
            text: "Bob's video that Alice liked",
            sourceDeletedAt: null,
            assets: [],
          },
        }),
      ],
    });
    wrapper = mountBrowse(model);

    const record = wrapper.find(".bluesky-record");
    expect(record.find(".relationship").text()).toBe("Liked");
    expect(record.find(".author").text()).toBe("bob.test");
    expect(record.find(".record-text").text()).toBe(
      "Bob's video that Alice liked",
    );
  });

  it("says when a record is no longer on Bluesky", () => {
    const model = createModel();
    model.browsePage = browsePage({
      records: [savedPost({ sourceDeletedAt: "2026-02-01T00:00:00.000Z" })],
    });
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 1,
          assetsExpected: 0,
          assetsAvailable: 0,
        },
      ],
      complete: true,
    };
    wrapper = mountBrowse(model);

    expect(wrapper.find(".source-deleted").text()).toContain(
      "No longer on Bluesky",
    );
  });

  it("walks to older records and back to the newest", async () => {
    const model = createModel();
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 4,
          assetsExpected: 0,
          assetsAvailable: 0,
        },
      ],
      complete: true,
    };
    model.browsePage = browsePage({ nextCursor: "cursor-1" });
    vi.mocked(window.electron.Bluesky.browse).mockResolvedValue(
      browsePage({ nextCursor: null }),
    );
    wrapper = mountBrowse(model);

    await wrapper.find(".browse-older").trigger("click");
    await wrapper.vm.$nextTick();

    expect(window.electron.Bluesky.browse).toHaveBeenCalledWith(
      7,
      "posts",
      "cursor-1",
    );
    expect(wrapper.find(".browse-newest").exists()).toBe(true);
  });

  it("switching category reads that category", async () => {
    const model = createModel();
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 1,
          assetsExpected: 0,
          assetsAvailable: 0,
        },
      ],
      complete: true,
    };
    model.browsePage = browsePage();
    wrapper = mountBrowse(model);

    await wrapper.findAll(".category-tab")[2].trigger("click");

    expect(window.electron.Bluesky.browse).toHaveBeenCalledWith(
      7,
      "likes",
      null,
    );
  });

  it("says so when there is nothing saved yet", () => {
    const model = createModel();
    model.savedData = { categories: [], complete: true };
    model.browsePage = browsePage({ records: [], totalRecords: 0 });
    wrapper = mountBrowse(model);

    expect(wrapper.find(".nothing-saved").text()).toContain(
      "hasn't saved anything for this account yet",
    );
  });
});
