import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BlueskyViewModel } from "./view_model";
import { State } from "./types";
import { AutomationErrorType } from "../../automation_errors";
import type { Account, BlueskyLocalAccount } from "../../../../shared_types";
import {
  browserAutomationAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockEmitter,
  mockElectronAPI,
} from "../../test_util";

function createBlueskyAccount(
  overrides?: Partial<BlueskyLocalAccount>,
): Account {
  return createMockAccount({
    id: 7,
    type: "Bluesky",
    uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
    xAccount: null,
    blueskyLocalAccount: createMockBlueskyLocalAccount({
      uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      ...overrides,
    }),
  });
}

function createViewModel(overrides?: Partial<BlueskyLocalAccount>) {
  return new BlueskyViewModel(
    createBlueskyAccount(overrides),
    createMockEmitter(),
  );
}

describe("BlueskyViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("starts on the dashboard, with no login step", () => {
      const model = createViewModel();

      expect(model.state).toBe(State.BlueskyWizardDashboard);
    });

    it("opens the account's private local storage on init", async () => {
      const model = createViewModel();

      await model.init();

      expect(window.electron.Bluesky.openLocalAccount).toHaveBeenCalledWith(7);
    });

    it("picks up the profile that local storage already captured", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.openLocalAccount).mockResolvedValue(
        createMockBlueskyLocalAccount({
          uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
      );

      await model.init();

      expect(model.localAccount?.handle).toBe("alice.bsky.social");
      expect(model.localAccount?.displayName).toBe("Alice");
    });

    it("keeps the existing profile when local storage returns nothing", async () => {
      const model = createViewModel({ handle: "alice.bsky.social" });
      vi.mocked(window.electron.Bluesky.openLocalAccount).mockResolvedValue(
        null,
      );

      await model.init();

      expect(model.localAccount?.handle).toBe("alice.bsky.social");
    });

    it("discards staged work left behind by an interrupted session", async () => {
      const model = createViewModel();

      await model.init();

      expect(window.electron.Bluesky.clearStagingAreas).toHaveBeenCalledWith(7);
    });

    it("never shows the browser, because Bluesky uses the AT Protocol directly", async () => {
      const model = createViewModel();

      await model.init();

      expect(model.showBrowser).toBe(false);
      expect(model.showAutomationNotice).toBe(false);
    });

    it.each(browserAutomationAPI.filter((method) => method !== "init"))(
      "has no %s to call, because it builds on the webview-free core",
      (method) => {
        const model = createViewModel();

        expect(method in model).toBe(false);
      },
    );
  });

  describe("state loop", () => {
    it("moves from the dashboard to its display state", async () => {
      const model = createViewModel();

      await model.run();

      expect(model.state).toBe(State.BlueskyWizardDashboardDisplay);
      expect(model.instructions).not.toBe("");
    });

    it("stays on the dashboard display state", async () => {
      const model = createViewModel();
      model.state = State.BlueskyWizardDashboardDisplay;

      await model.run();

      expect(model.state).toBe(State.BlueskyWizardDashboardDisplay);
    });

    it("returns to the dashboard from an unrecognized state", async () => {
      const model = createViewModel();
      model.state = State.Login;

      await model.run();

      expect(model.state).toBe(State.BlueskyWizardDashboard);
    });

    it("moves from connect to its display state", async () => {
      const model = createViewModel();
      model.state = State.BlueskyWizardConnect;

      await model.run();

      expect(model.state).toBe(State.BlueskyWizardConnectDisplay);
      expect(model.instructions).not.toBe("");
    });
  });

  describe("connecting", () => {
    it("listens on its own account's flow, not a global one", () => {
      expect(createViewModel().oauthCallbackEventName).toBe(
        "blueskyOAuthCallback-Bluesky:7",
      );
    });

    it("reads connection state from the account, not from the DID", () => {
      expect(createViewModel({ did: "did:plc:examplealice" }).isConnected).toBe(
        false,
      );
      expect(
        createViewModel({
          did: "did:plc:examplealice",
          connectedAt: new Date(),
        }).isConnected,
      ).toBe(true);
    });

    it("starts a browser authorization for a handle", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.connect).mockResolvedValue({
        status: "browser",
      });

      const started = await model.connect("alice.bsky.social");

      expect(started).toEqual({ status: "browser" });
      expect(window.electron.Bluesky.connect).toHaveBeenCalledWith(
        7,
        "alice.bsky.social",
      );
      expect(model.connectError).toBe("");
    });

    it("shows a failure beside the handle rather than throwing it away", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.connect).mockResolvedValue({
        status: "error",
        error: "Could not resolve handle",
      });

      await model.connect("nobody.bsky.social");

      expect(model.connectError).toBe("Could not resolve handle");
    });

    it("connects with no browser round trip when a session already exists", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.connect).mockResolvedValue({
        status: "reused",
        did: "did:plc:examplealice",
      });
      vi.mocked(window.electron.Bluesky.openLocalAccount).mockResolvedValue(
        createMockBlueskyLocalAccount({
          uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
          did: "did:plc:examplealice",
          handle: "alice.bsky.social",
          connectedAt: new Date(),
        }),
      );

      const started = await model.connect("alice.bsky.social");

      expect(started).toEqual({
        status: "reused",
        did: "did:plc:examplealice",
      });
      expect(model.isConnected).toBe(true);
    });

    it("binds the identity when the browser authorization comes back", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.completeConnection).mockResolvedValue(
        true,
      );
      vi.mocked(window.electron.Bluesky.openLocalAccount).mockResolvedValue(
        createMockBlueskyLocalAccount({
          uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
          did: "did:plc:examplealice",
          handle: "alice.bsky.social",
          connectedAt: new Date(),
        }),
      );
      vi.mocked(window.electron.Bluesky.getProfile).mockResolvedValue({
        did: "did:plc:examplealice",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });

      expect(await model.completeConnection("code=abc")).toBe(true);
      expect(model.isConnected).toBe(true);
      expect(model.profile?.handle).toBe("alice.bsky.social");
    });

    it("reports a refused authorization without connecting", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.completeConnection).mockResolvedValue(
        "denied",
      );

      expect(await model.completeConnection("error=access_denied")).toBe(false);
      expect(model.connectError).toBe("denied");
      expect(model.isConnected).toBe(false);
    });

    it("releases only this account's hold when disconnecting", async () => {
      const model = createViewModel({
        did: "did:plc:examplealice",
        connectedAt: new Date(),
      });
      vi.mocked(window.electron.Bluesky.openLocalAccount).mockResolvedValue(
        createMockBlueskyLocalAccount({
          uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
          did: "did:plc:examplealice",
          connectedAt: null,
        }),
      );

      await model.disconnect();

      expect(window.electron.Bluesky.disconnect).toHaveBeenCalledWith(7);
      expect(model.isConnected).toBe(false);
      expect(model.profile).toBeNull();
      // The local account and its identity binding survive the disconnection.
      expect(model.localAccount?.did).toBe("did:plc:examplealice");
    });

    it("asks for no profile while the account is disconnected", async () => {
      const model = createViewModel({ did: "did:plc:examplealice" });

      await model.refreshProfile();

      expect(window.electron.Bluesky.getProfile).not.toHaveBeenCalled();
      expect(model.profile).toBeNull();
    });
  });

  describe("automatic diagnostics", () => {
    it("reports only operational metadata when a state fails", async () => {
      const model = createViewModel({
        did: "did:plc:examplealice",
        handle: "alice.bsky.social",
      });
      const errorSpy = vi
        .spyOn(model, "error")
        .mockResolvedValue(undefined as never);
      vi.spyOn(model, "t").mockImplementation(() => {
        throw new TypeError("boom");
      });

      await model.run();

      expect(errorSpy).toHaveBeenCalledWith(
        AutomationErrorType.bluesky_runError,
        {
          state: State.BlueskyWizardDashboard,
          jobType: "",
          errorClass: "TypeError",
        },
      );
    });

    it("reports local storage it cannot open, and still shows the dashboard", async () => {
      const model = createViewModel();
      vi.mocked(window.electron.Bluesky.openLocalAccount).mockRejectedValue(
        new Error("EACCES: /home/alice/.cyd/Bluesky/data.sqlite3"),
      );

      await model.init();
      await model.run();

      expect(model.state).toBe(State.BlueskyWizardDashboardDisplay);
      const args = vi.mocked(window.electron.database.createErrorReport).mock
        .calls[0];
      expect(args[2]).toBe(AutomationErrorType.bluesky_openLocalAccountError);
      expect(`${args[3]}${args[6]}`).not.toContain("/home/alice");
    });

    it("excludes handles, DIDs, and local paths from the error report", async () => {
      const emitter = createMockEmitter();
      const model = new BlueskyViewModel(
        createBlueskyAccount({
          did: "did:plc:examplealice",
          handle: "alice.bsky.social",
          displayName: "Alice",
        }),
        emitter,
      );
      // Reporting an error pauses for the error modal, which only a person can
      // dismiss, so stand in for that person here.
      emitter.on("show-automation-error", () => {
        setTimeout(() => model.resume(), 0);
      });
      await model.init();
      vi.spyOn(model, "t").mockImplementation(() => {
        throw new TypeError("failed at /home/alice/.cyd/Bluesky/data.sqlite3");
      });

      await model.run();

      expect(window.electron.database.createErrorReport).toHaveBeenCalledTimes(
        1,
      );
      const args = vi.mocked(window.electron.database.createErrorReport).mock
        .calls[0];
      const [, , , errorReportData, username, screenshot, sensitiveContext] =
        args;

      expect(username).toBe("");
      expect(screenshot).toBe("");

      const report = `${errorReportData}${sensitiveContext}`;
      expect(report).not.toContain("alice.bsky.social");
      expect(report).not.toContain("did:plc:");
      expect(report).not.toContain("/home/alice");
      expect(report).not.toContain("sqlite3");
      expect(report).not.toContain("Alice");
    });
  });
});
