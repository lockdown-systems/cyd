import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import BlueskyProgressComponent from "./BlueskyProgressComponent.vue";
import { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import {
  mockElectronAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockEmitter,
} from "../../../test_util";
import type { BlueskyCollectionProgress } from "../../../../../shared_types";
import i18n from "../../../i18n";

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

const collection = (
  overrides: Partial<BlueskyCollectionProgress> = {},
): BlueskyCollectionProgress => ({
  category: "posts",
  stage: "listing",
  pagesListed: 2,
  recordsSaved: 40,
  mediaSaved: 10,
  mediaFailed: 0,
  mediaPending: 12,
  rateLimitedUntil: null,
  rateLimitOccurrences: 0,
  cancelled: false,
  ...overrides,
});

function mountProgress(model: BlueskyViewModel) {
  return mount(BlueskyProgressComponent, {
    props: { model },
    global: { plugins: [i18n] },
  });
}

describe("BlueskyProgressComponent", () => {
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

  it("says which category is being read, and how much is saved", () => {
    const model = createModel();
    model.progress.collection = collection();
    model.progress.recordsSaved = 40;
    model.progress.mediaSaved = 10;
    wrapper = mountProgress(model);

    expect(wrapper.find(".stage").text()).toBe(
      "Reading your Posts from Bluesky",
    );
    expect(wrapper.find(".records-saved").text()).toBe("40 records saved");
    expect(wrapper.find(".media-saved").text()).toBe("10 media files saved");
    expect(wrapper.find(".media-pending").text()).toBe(
      "12 media files still to go",
    );
  });

  it("says it is saving media once the records are in", () => {
    const model = createModel();
    model.progress.collection = collection({ stage: "media" });
    wrapper = mountProgress(model);

    expect(wrapper.find(".stage").text()).toBe("Saving media for your Posts");
  });

  it("a rate limit reads as waiting, with the time it resumes", () => {
    const resumeAt = new Date(Date.now() + 5 * 60 * 1000);
    const model = createModel();
    model.progress.collection = collection({
      rateLimitedUntil: resumeAt.toISOString(),
      rateLimitOccurrences: 1,
    });
    wrapper = mountProgress(model);

    const waiting = wrapper.find(".rate-limited");
    expect(waiting.text()).toContain("Bluesky is rate limiting Cyd");
    expect(waiting.text()).toContain(resumeAt.toLocaleTimeString());
  });

  it("media that could not be saved yet is said out loud", () => {
    const model = createModel();
    model.progress.collection = collection({ mediaFailed: 3 });
    model.progress.mediaFailed = 3;
    wrapper = mountProgress(model);

    expect(wrapper.find(".media-failed").text()).toBe(
      "3 media files couldn't be saved yet",
    );
  });

  it("shows no record, handle, or path", () => {
    const model = createModel();
    model.progress.collection = collection();
    wrapper = mountProgress(model);

    const shown = wrapper.text();
    expect(shown).not.toContain("alice");
    expect(shown).not.toContain("did:plc:");
    expect(shown).not.toContain("at://");
    expect(shown).not.toContain("/");
  });
});
