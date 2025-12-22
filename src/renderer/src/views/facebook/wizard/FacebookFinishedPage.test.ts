import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import FacebookFinishedPage from "./FacebookFinishedPage.vue";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import { FacebookViewModel } from "../../../view_models/FacebookViewModel";
import { emptyFacebookProgress } from "../../../view_models/FacebookViewModel/types";
import en from "../../../i18n/locales/en.json";
import {
  createMockAccount,
  createMockFacebookAccount,
  createMockEmitter,
  mockElectronAPI,
} from "../../../test_util";

// Create i18n instance for tests
const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: { en },
});

// Mock the BaseWizardPage component
vi.mock("../../shared_components/wizard/BaseWizardPage.vue", () => ({
  default: {
    name: "BaseWizardPage",
    props: ["breadcrumbProps", "buttonProps"],
    template: `
      <div class="mock-base-wizard-page">
        <slot name="content"></slot>
      </div>
    `,
  },
}));

/**
 * Creates a mock FacebookViewModel for testing
 */
function createMockFacebookViewModel(): FacebookViewModel {
  const mockFacebookAccount = createMockFacebookAccount({
    accountID: "123456789",
    deleteWallPosts: true,
  });
  const mockAccount = createMockAccount({
    type: "Facebook",
    xAccount: null,
    facebookAccount: mockFacebookAccount,
  });
  const mockEmitter = createMockEmitter();

  const vm = new FacebookViewModel(mockAccount, mockEmitter);
  vm.progress = emptyFacebookProgress();

  return vm;
}

describe("FacebookFinishedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  describe("rendering", () => {
    it("renders the finished page", () => {
      const vm = createMockFacebookViewModel();

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      expect(wrapper.find(".mock-base-wizard-page").exists()).toBe(true);
    });

    it("shows You just deleted heading", () => {
      const vm = createMockFacebookViewModel();

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      expect(wrapper.text()).toContain("You just deleted");
    });

    it("shows wall posts deleted count", () => {
      const vm = createMockFacebookViewModel();
      vm.progress.wallPostsDeleted = 42;

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      expect(wrapper.text()).toContain("42");
      expect(wrapper.text()).toContain("wall posts");
    });

    it("formats large numbers with locale string", () => {
      const vm = createMockFacebookViewModel();
      vm.progress.wallPostsDeleted = 1234567;

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      expect(wrapper.text()).toContain("1,234,567");
    });

    it("shows fire icon for deleted items", () => {
      const vm = createMockFacebookViewModel();
      vm.progress.wallPostsDeleted = 10;

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      expect(wrapper.find(".fa-fire").exists()).toBe(true);
      expect(wrapper.find(".delete-bullet").exists()).toBe(true);
    });
  });

  describe("events", () => {
    it("emits setState with Dashboard state when back to dashboard is clicked", async () => {
      const vm = createMockFacebookViewModel();

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      // Get the button props passed to BaseWizardPage
      const baseWizardPage = wrapper.findComponent(BaseWizardPage);
      const buttonProps = baseWizardPage.props("buttonProps");

      // Call the action for the next button
      expect(buttonProps).toBeDefined();
      buttonProps!.nextButtons[0].action();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")![0]).toEqual([
        "FacebookWizardDashboard",
      ]);
    });
  });

  describe("breadcrumb", () => {
    it("uses delete icon for breadcrumb", () => {
      const vm = createMockFacebookViewModel();

      const wrapper = mount(FacebookFinishedPage, {
        global: {
          plugins: [i18n],
        },
        props: {
          model: vm,
        },
      });

      const baseWizardPage = wrapper.findComponent(BaseWizardPage);
      const breadcrumbProps = baseWizardPage.props("breadcrumbProps");

      // Should use delete icon, not finished
      expect(breadcrumbProps).toBeDefined();
      expect(breadcrumbProps!.icon).toBeDefined();
    });
  });
});
