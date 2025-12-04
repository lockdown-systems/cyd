import { afterEach, describe, expect, it } from "vitest";
import { translate } from "./translator";
import i18n from "./index";

const X_WIZARD_KEYS = [
  "viewModels.x.wizard.login.action",
  "viewModels.x.wizard.login.instructions",
  "viewModels.x.wizard.dashboard",
  "viewModels.x.wizard.database",
  "viewModels.x.wizard.importStart",
  "viewModels.x.wizard.importing",
  "viewModels.x.wizard.buildOptions",
  "viewModels.x.wizard.archiveOptions",
  "viewModels.x.wizard.deleteOptions",
  "viewModels.x.wizard.review",
  "viewModels.x.wizard.deleteReview.base",
  "viewModels.x.wizard.deleteReview.withStats",
  "viewModels.x.wizard.migrateToBluesky",
  "viewModels.x.wizard.tombstone",
  "viewModels.x.wizard.archiveOnly",
  "viewModels.x.wizard.finishedJobs",
  "viewModels.x.wizard.checkPremium",
  "viewModels.x.wizard.debug",
];

describe("translator", () => {
  afterEach(() => {
    i18n.global.locale.value = "en";
  });

  it("falls back to English when locale is unsupported", () => {
    const key = "viewModels.x.wizard.login.action";
    const englishValue = translate(key);

    i18n.global.locale.value = "fr";

    expect(translate(key)).toBe(englishValue);
  });

  it("provides copy for every X wizard state", () => {
    for (const key of X_WIZARD_KEYS) {
      expect(translate(key)).not.toBe(key);
    }
  });
});
