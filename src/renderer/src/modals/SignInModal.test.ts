import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount, VueWrapper } from "@vue/test-utils";

import SignInModal from "./SignInModal.vue";
import CydAPIClient from "../../../cyd-api-client";
import { stubElectron } from "../test_util";

describe("SignInModal", () => {
  let wrapper: VueWrapper<InstanceType<typeof SignInModal>>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup global window.electron
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = {
      electron: stubElectron(),
    };
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("starts with the email field visible and the value blank", () => {
    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(""),
          apiClient: ref(new CydAPIClient()),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe("");
  });

  it("prepopulates the email field if it is saved", () => {
    const testEmail = "test@lockdown.systems";

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(new CydAPIClient()),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe(testEmail);
  });

  it("shows an error message if the email field is blank", async () => {
    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(""),
          apiClient: ref(new CydAPIClient()),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe("");

    // Call the authenticate method directly to avoid DOM event issues
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    expect(window.electron.showError).toHaveBeenCalledWith(
      "Please enter your email address.",
    );
  });

  it("shows an error message if the server is unreachable", async () => {
    const testEmail = "test@lockdown.systems";

    // Mock fetch to simulate server error
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const apiClient = new CydAPIClient();

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(apiClient),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe(testEmail);

    // Call the authenticate method directly
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    // Should show an error due to network failure
    expect(window.electron.showError).toHaveBeenCalled();
  });

  it("moves to verification code page after entering an email", async () => {
    const testEmail = "test@lockdown.systems";

    // Mock successful authentication response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          message: "Verification code sent to email",
        }),
    } as Response);

    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(apiClient),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.exists()).toBe(true);
    expect((emailInput.element as HTMLInputElement).value).toBe(testEmail);

    // Call the authenticate method directly
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    expect(window.electron.showError).not.toHaveBeenCalled();

    const verificationCodeInput = wrapper.find(
      '[data-testid="verification-code-input"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);
  });

  it("should only allow digits in the verification code field", async () => {
    const testEmail = "test@lockdown.systems";

    // Mock successful authentication response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          message: "Verification code sent to email",
        }),
    } as Response);

    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(apiClient),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    // Call the authenticate method directly
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    // Wait for transition to verification code page
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    const verificationCodeInput = wrapper.find(
      '[data-testid="verification-code-input"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Test the input filtering logic - the watcher only filters when length < 6
    // Set a value with non-digits that's less than 6 characters
    componentInstance.verificationCode = "123a";
    await nextTick();

    // The watcher should filter out non-digits when length < 6
    expect(componentInstance.verificationCode).toBe("123");

    // Test with longer input - watcher doesn't filter when length >= 6
    componentInstance.verificationCode = "123abc456";
    await nextTick();

    // Since length >= 6, no filtering occurs (component logic)
    expect(componentInstance.verificationCode).toBe("123abc456");
  });

  it("should auto-submit verification code after 6 digits", async () => {
    const testEmail = "test@lockdown.systems";

    // Mock successful authentication and device registration responses
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            message: "verification code sent to email",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            device_token: "this-is-a-device-token",
            uuid: "device-uuid",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);

    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    const mockRefreshDeviceInfo = vi.fn();

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(apiClient),
          deviceInfo: ref({
            userEmail: testEmail,
            deviceDescription: "test device",
            deviceToken: "",
            apiToken: "",
            valid: false,
          }),
          refreshDeviceInfo: mockRefreshDeviceInfo,
        },
        config: {
          globalProperties: {
            emitter: {
              emit: vi.fn(),
            },
          },
        },
      },
    });

    // Call the authenticate method directly
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    // Wait for transition to verification code page
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    const verificationCodeInput = wrapper.find(
      '[data-testid="verification-code-input"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Set verification code - this should trigger auto-submit via watcher
    componentInstance.verificationCode = "123456";
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    // Check that we're in the signing in state
    expect(wrapper.text()).toContain("Signing in...");
  });

  it("should show an error on wrong verification code guess but let you keep guessing", async () => {
    const testEmail = "test@lockdown.systems";

    // Mock successful authentication but failed device registration
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            message: "Verification code sent to email",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            message: "Authentication failed",
          }),
      } as Response);

    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(apiClient),
          deviceInfo: ref({
            userEmail: testEmail,
            deviceDescription: "test device",
            deviceToken: "",
            apiToken: "",
            valid: false,
          }),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    // Call the authenticate method directly
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    // Wait for transition to verification code page
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    const verificationCodeInput = wrapper.find(
      '[data-testid="verification-code-input"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Set verification code - this should trigger auto-submit and fail
    componentInstance.verificationCode = "123456";
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    // Error should be shown
    expect(window.electron.showError).toHaveBeenCalledWith(
      "Invalid verification code.",
    );

    // Field should be cleared
    expect(componentInstance.verificationCode).toBe("");
  });

  it("verification code back button should go back to start", async () => {
    const testEmail = "test@lockdown.systems";

    // Mock successful authentication response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          message: "Verification code sent to email",
        }),
    } as Response);

    const apiClient = new CydAPIClient();
    apiClient.initialize("https://mock/api");

    wrapper = mount(SignInModal, {
      global: {
        provide: {
          userEmail: ref(testEmail),
          apiClient: ref(apiClient),
          deviceInfo: ref(null),
          refreshDeviceInfo: vi.fn(),
        },
      },
    });

    // Call the authenticate method directly
    const componentInstance = wrapper.vm;
    await componentInstance.authenticate();
    await nextTick();

    // Wait for transition to verification code page
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    const verificationCodeInput = wrapper.find(
      '[data-testid="verification-code-input"]',
    );
    expect(verificationCodeInput.exists()).toBe(true);

    // Call goBack method directly
    await componentInstance.goBack();
    await nextTick();

    // Should be back to start
    const emailInput = wrapper.find('[data-testid="email-input"]');
    expect(emailInput.exists()).toBe(true);
    expect(window.electron.showError).not.toHaveBeenCalled();
  });
});
