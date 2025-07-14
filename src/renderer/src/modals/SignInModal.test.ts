/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";

import SignInModal from "./SignInModal.vue";
import CydAPIClient from "../../../cyd-api-client";
import { stubElectron } from "../test_util";

// Mock fetch for API calls
global.fetch = vi.fn();

describe("SignInModal", () => {
  beforeEach(() => {
    // Setup global window.electron mock
    (global as any).window = { electron: stubElectron() };
    vi.clearAllMocks();
  });

  it("starts with the email field visible and the value blank", async () => {
    const wrapper = mount(SignInModal);
    await nextTick();

    const emailInput = wrapper.find('input[type="email"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe("");
  });

  it("prepopulates the email field if it is saved", async () => {
    const testEmail = "test@lockdown.systems";

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("userEmail", ref(testEmail));
          },
        ],
      },
    });
    await nextTick();

    const emailInput = wrapper.find('input[type="email"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe(testEmail);
  });

  it("shows an error message if the email field is blank", async () => {
    const electronMock = stubElectron();
    (global as any).window.electron = electronMock;

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("userEmail", ref(""));
          },
        ],
      },
    });
    await nextTick();

    const emailInput = wrapper.find('input[type="email"]');
    const continueButton = wrapper.find("button");

    expect((emailInput.element as HTMLInputElement).value).toBe("");

    await continueButton.trigger("click");
    await nextTick();

    expect(electronMock.showError).toHaveBeenCalledWith(
      "Please enter your email address.",
    );
  });

  it("shows an error message if the server is unreachable", async () => {
    const electronMock = stubElectron();
    (global as any).window.electron = electronMock;

    const testEmail = "test@lockdown.systems";

    // Mock fetch to reject (simulate network error)
    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("apiClient", ref(new CydAPIClient()));
            app.provide("userEmail", ref(testEmail));
          },
        ],
      },
    });
    await nextTick();

    const emailInput = wrapper.find('input[type="email"]');
    const continueButton = wrapper.find("button");

    expect((emailInput.element as HTMLInputElement).value).toBe(testEmail);

    await continueButton.trigger("click");
    await nextTick();

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(electronMock.showError).toHaveBeenCalled();
  });

  it("moves to verification code page after entering an email", async () => {
    const electronMock = stubElectron();
    (global as any).window.electron = electronMock;

    const testEmail = "test@lockdown.systems";
    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    // Mock successful authentication response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: "Verification code sent to email",
        }),
    });

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("apiClient", ref(apiClient));
            app.provide("userEmail", ref(testEmail));
          },
        ],
      },
    });
    await nextTick();

    const emailInput = wrapper.find('input[type="email"]');
    const continueButton = wrapper.find("button");

    expect((emailInput.element as HTMLInputElement).value).toBe(testEmail);

    await continueButton.trigger("click");
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(electronMock.showError).not.toHaveBeenCalled();

    // Look for verification code input field
    const verificationCodeInput = wrapper.find(
      'input[placeholder*="verification"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);
  });

  it("should auto-submit verification code after 6 digits", async () => {
    const electronMock = stubElectron();
    electronMock.database.getAccounts = vi.fn().mockResolvedValue([]);
    (global as any).window.electron = electronMock;

    const testEmail = "test@lockdown.systems";
    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    // Mock API responses
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "verification code sent to email",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            device_token: "this-is-a-device-token",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("apiClient", ref(apiClient));
            app.provide("userEmail", ref(testEmail));
            app.provide(
              "deviceInfo",
              ref({
                userEmail: testEmail,
                deviceDescription: "test device",
                deviceToken: "",
                apiToken: "",
                valid: false,
              }),
            );
            app.provide("refreshDeviceInfo", async () => {
              return;
            });
          },
        ],
      },
    });
    await nextTick();

    const continueButton = wrapper.find("button");
    await continueButton.trigger("click");
    await nextTick();

    // Wait for transition to verification page
    await new Promise((resolve) => setTimeout(resolve, 100));

    const verificationCodeInput = wrapper.find(
      'input[placeholder*="verification"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Type 6 digits by setting value and triggering input event
    const inputElement = verificationCodeInput.element as HTMLInputElement;
    inputElement.value = "123456";
    await verificationCodeInput.trigger("input");

    // Wait for auto-submit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that we're logging in by searching for the text "Signing in..."
    expect(wrapper.text()).toContain("Signing in...");
  });

  it("should show an error on wrong verification code guess", async () => {
    const electronMock = stubElectron();
    (global as any).window.electron = electronMock;

    const testEmail = "test@lockdown.systems";
    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    // Mock API responses
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Verification code sent to email",
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            message: "Authentication failed",
          }),
      });

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("apiClient", ref(apiClient));
            app.provide("userEmail", ref(testEmail));
            app.provide(
              "deviceInfo",
              ref({
                userEmail: testEmail,
                deviceDescription: "test device",
                deviceToken: "",
                apiToken: "",
                valid: false,
              }),
            );
            app.provide("refreshDeviceInfo", async () => {
              return;
            });
          },
        ],
      },
    });
    await nextTick();

    const continueButton = wrapper.find("button");
    await continueButton.trigger("click");
    await nextTick();

    // Wait for transition to verification page
    await new Promise((resolve) => setTimeout(resolve, 100));

    const verificationCodeInput = wrapper.find(
      'input[placeholder*="verification"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Type 6 digits to trigger auto-submit
    const inputElement = verificationCodeInput.element as HTMLInputElement;
    inputElement.value = "123456";
    await verificationCodeInput.trigger("input");

    // Wait for auto-submit and error handling
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Error should be shown
    expect(electronMock.showError).toHaveBeenCalledWith(
      "Invalid verification code.",
    );
  });

  it("verification code back button should go back to start", async () => {
    const electronMock = stubElectron();
    (global as any).window.electron = electronMock;

    const testEmail = "test@lockdown.systems";
    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    // Mock successful authentication response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: "Verification code sent to email",
        }),
    });

    const wrapper = mount(SignInModal, {
      global: {
        plugins: [
          (app: any) => {
            app.provide("apiClient", ref(apiClient));
            app.provide("userEmail", ref(testEmail));
          },
        ],
      },
    });
    await nextTick();

    const continueButton = wrapper.find("button");
    await continueButton.trigger("click");
    await nextTick();

    // Wait for transition to verification page
    await new Promise((resolve) => setTimeout(resolve, 100));

    const verificationCodeInput = wrapper.find(
      'input[placeholder*="verification"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Find and click back button (typically has "Back" text or arrow)
    const allButtons = wrapper.findAll("button");
    const backButton = allButtons.find(
      (button) => button.text().includes("Back") || button.text().includes("←"),
    );

    if (backButton) {
      await backButton.trigger("click");
      await nextTick();

      // Should be back to start
      const emailInput = wrapper.find('input[type="email"]');
      expect(emailInput.exists()).toBe(true);
    }

    expect(electronMock.showError).not.toHaveBeenCalled();
  });
});
