import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount, VueWrapper } from "@vue/test-utils";

import TabsView from "./TabsView.vue";
import CydAPIClient from "../../../cyd-api-client";
import { mockElectronAPI } from "../test_util";
import { Account } from "../../../shared_types";
import i18n from "../i18n";

let accountID = 1;
const testDatabase = {
  accounts: [] as Account[],
  config: {} as Record<string, string>,
};

function generateRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  const randomValues = crypto.getRandomValues(new Uint32Array(length));
  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomValues[i] % charactersLength);
  }
  return result;
}

// Define a type that includes the component's internal methods
type TabsViewInstance = InstanceType<typeof TabsView> & {
  reloadAccounts: () => Promise<void>;
  addAccountClicked: () => Promise<void>;
  accountSelected: (account: Account, accountType: string) => Promise<void>;
  removeAccount: (accountId: number) => Promise<void>;
};

describe("TabsView", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    testDatabase.accounts = [];
    testDatabase.config = {};

    // Reset mocks
    vi.clearAllMocks();

    // Setup global window.electron
    mockElectronAPI();

    window.electron.showQuestion = vi.fn().mockResolvedValue(true);

    window.electron.database.getConfig = vi
      .fn()
      .mockImplementation(async (key: string) => {
        return testDatabase.config[key];
      });
    window.electron.database.setConfig = vi
      .fn()
      .mockImplementation(async (key: string, value: string) => {
        testDatabase.config[key] = value;
      });
    window.electron.database.getAccounts = vi
      .fn()
      .mockImplementation(async () => {
        return [...testDatabase.accounts]; // Return a copy to trigger reactivity
      });
    window.electron.database.createAccount = vi
      .fn()
      .mockImplementation(async () => {
        const accountUUID = generateRandomString(32);
        const newAccount: Account = {
          id: accountID,
          type: "unknown",
          sortOrder: 0,
          xAccount: null,
          blueskyAccount: null,
          uuid: accountUUID,
        };
        testDatabase.accounts.push(newAccount);
        // autoincrement the id for the next account
        accountID += 1;
        return newAccount;
      });
    window.electron.database.selectAccountType = vi
      .fn()
      .mockImplementation(async (accountIDParam, type) => {
        const index = testDatabase.accounts.findIndex(
          (acc) => acc.id === accountIDParam,
        );
        if (index !== -1) {
          testDatabase.accounts[index].type = type;
        }
        return testDatabase.accounts[index];
      });
    window.electron.database.saveAccount = vi
      .fn()
      .mockImplementation(async (accountJson) => {
        const account = JSON.parse(accountJson);
        const index = testDatabase.accounts.findIndex(
          (acc) => acc.id === account.id,
        );
        if (index !== -1) {
          testDatabase.accounts[index] = account;
        }
      });
    window.electron.database.deleteAccount = vi
      .fn()
      .mockImplementation(async (accountIDParam) => {
        testDatabase.accounts = testDatabase.accounts.filter(
          (acc) => acc.id !== accountIDParam,
        );
      });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    testDatabase.accounts = [];
    testDatabase.config = {};
    accountID = 1;
  });

  const mountComponent = async () => {
    wrapper = mount(TabsView, {
      props: {
        updatesAvailable: false,
      },
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref(new CydAPIClient()),
          deviceInfo: ref({
            userEmail: "test@lockdown.systems",
            deviceDescription: "Test Device",
            deviceToken: "",
            deviceUUID: "",
            apiToken: "",
            valid: false,
          }),
          refreshDeviceInfo: vi.fn(),
          refreshAPIClient: vi.fn(),
        },
        config: {
          globalProperties: {
            emitter: {
              on: vi.fn(),
              emit: vi.fn(),
              off: vi.fn(),
            },
          },
        },
      },
    });

    // Wait for component to mount and create initial account
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await nextTick();

    // Force component to reload accounts to sync with our mock database
    const componentInstance = wrapper.vm as TabsViewInstance;
    await componentInstance.reloadAccounts();
    await nextTick();
  };

  it("starts with one unknown accounts and signed out", async () => {
    await mountComponent();

    // Check that the user button exists
    const userBtn = wrapper.find(".user-btn");
    expect(userBtn.exists()).toBe(true);

    // Check that there is exactly 1 AccountButton component (a new unknown one)
    const accountButtons = wrapper.findAll(".accounts-list .account-button");
    expect(accountButtons).toHaveLength(1);

    // Make sure that .account-button-1 exists
    const accountButton1 = wrapper.find(".account-button-1");
    expect(accountButton1.exists()).toBe(true);

    // Verify deviceInfo shows not signed in (valid: false means not signed in)
    const deviceInfo = wrapper.vm.$.provides.deviceInfo;
    expect(deviceInfo.value.valid).toBe(false);
  });

  it("if you add another unknown account, it uses the existing one", async () => {
    await mountComponent();

    // Add a new account using component method directly to avoid event issues
    const componentInstance = wrapper.vm as TabsViewInstance;
    await componentInstance.addAccountClicked();
    await nextTick();

    // Check that there is still only 1 AccountButton component
    const accountButtons = wrapper.findAll(".accounts-list .account-button");
    expect(accountButtons).toHaveLength(1);

    // Make sure that .account-button-1 exists
    const accountButton1 = wrapper.find(".account-button-1");
    expect(accountButton1.exists()).toBe(true);
  });

  it("if you select X, you can then add another unknown account", async () => {
    await mountComponent();

    const componentInstance = wrapper.vm as TabsViewInstance;

    // Get the first account and select X type
    const firstAccount = testDatabase.accounts[0];
    await componentInstance.accountSelected(firstAccount, "X");
    await nextTick();

    // Add a new account
    await componentInstance.addAccountClicked();
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    // Check that there are now 2 AccountButton components
    const accountButtons = wrapper.findAll(".accounts-list .account-button");
    expect(accountButtons).toHaveLength(2);

    // Make sure that .account-button-1 and .account-button-2 exists
    const accountButton1 = wrapper.find(".account-button-1");
    const accountButton2 = wrapper.find(".account-button-2");
    expect(accountButton1.exists()).toBe(true);
    expect(accountButton2.exists()).toBe(true);
  });

  it("add 3 accounts, delete the 2nd, add a 4th, and make sure the IDs are correct", async () => {
    await mountComponent();

    const componentInstance = wrapper.vm as TabsViewInstance;

    // Add 3 accounts by selecting account types and adding new ones
    const firstAccount = testDatabase.accounts[0];
    await componentInstance.accountSelected(firstAccount, "X");
    await nextTick();

    await componentInstance.addAccountClicked();
    await nextTick();

    const secondAccount = testDatabase.accounts[1];
    await componentInstance.accountSelected(secondAccount, "X");
    await nextTick();

    await componentInstance.addAccountClicked();
    await nextTick();

    const thirdAccount = testDatabase.accounts[2];
    await componentInstance.accountSelected(thirdAccount, "X");
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(wrapper.find(".account-button-1").exists()).toBe(true);
    expect(wrapper.find(".account-button-2").exists()).toBe(true);
    expect(wrapper.find(".account-button-3").exists()).toBe(true);
    expect(wrapper.find(".account-button-4").exists()).toBe(false);

    // Delete the second account using component method
    await componentInstance.removeAccount(2);
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(wrapper.find(".account-button-1").exists()).toBe(true);
    expect(wrapper.find(".account-button-2").exists()).toBe(false);
    expect(wrapper.find(".account-button-3").exists()).toBe(true);
    expect(wrapper.find(".account-button-4").exists()).toBe(false);
    expect(wrapper.find(".account-button-5").exists()).toBe(false);

    // Add a new account
    await componentInstance.addAccountClicked();
    await nextTick();

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    // Check that the IDs are correct
    expect(wrapper.find(".account-button-1").exists()).toBe(true);
    expect(wrapper.find(".account-button-2").exists()).toBe(false);
    expect(wrapper.find(".account-button-3").exists()).toBe(true);
    expect(wrapper.find(".account-button-4").exists()).toBe(true);
    expect(wrapper.find(".account-button-5").exists()).toBe(false);
  });
});
