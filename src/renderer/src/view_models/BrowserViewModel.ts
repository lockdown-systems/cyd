import { WebviewTag } from "electron";
import { BaseViewModel, type ErrorReportPageContext } from "./BaseViewModel";
import {
  InternetDownError,
  TimeoutError,
  URLChangedError,
} from "./automation_failures";

const DEFAULT_TIMEOUT = 30000;

/**
 * A view model for a platform Cyd drives through an embedded browser.
 *
 * X and Facebook expose no usable API, so Cyd works them the way a person
 * does: load a page in a webview, wait for it, read the DOM, click. Every
 * method here needs that webview, which is why this layer is separate. A
 * platform that talks to an API directly builds on BaseViewModel and never
 * sees any of it.
 */
export class BrowserViewModel extends BaseViewModel {
  public webview: WebviewTag | null = null;
  public webContentsID: number | null = null;
  public isWebviewDestroyed: boolean = false;
  public domReady: boolean = false;

  public cancelWaitForURL: boolean = false;

  public domReadyHandler: () => void = async () => {};

  /** Stop listening to the webview this view model was handed. */
  cleanup() {
    // Remove the event listener
    this.getWebview()?.removeEventListener("dom-ready", this.domReadyHandler);
  }

  /**
   * The page the failure happened on: its URL, plus a screenshot when the
   * person could see the browser at the time.
   */
  protected async errorReportPageContext(): Promise<ErrorReportPageContext> {
    const webview = this.getWebview();
    if (!webview) {
      return {};
    }

    return {
      currentURL: webview.getURL(),
      screenshotDataURL: this.showBrowser
        ? (await webview.capturePage()).toDataURL()
        : "",
    };
  }

  async init(webview: WebviewTag) {
    this.webview = webview;

    this.domReadyHandler = async () => {
      this.log("domReadyHandler", "dom-ready");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // dom-ready has been fired
      this.domReady = true;

      const webview = this.getWebview();
      if (webview) {
        // Set the webContentsID
        this.webContentsID = webview.getWebContentsId();

        // Remove the event listener
        webview.removeEventListener("dom-ready", this.domReadyHandler);
      }
    };
    this.getWebview()?.addEventListener("dom-ready", this.domReadyHandler);

    // Open devtools if needed
    const shouldOpenDevtools = await window.electron.shouldOpenDevtools();

    if (shouldOpenDevtools) {
      this.getWebview()?.openDevTools();
    }

    // Wait for dom-ready
    while (!this.domReady) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  destroy() {
    this.isWebviewDestroyed = true;
  }

  getWebview(): WebviewTag | null {
    if (this.isWebviewDestroyed) {
      return null;
    }
    return this.webview;
  }

  /**
   * Safely execute JavaScript in the webview with proper error handling.
   * This method:
   * 1. Checks if webview is valid
   * 2. Wraps execution in try-catch
   * 3. Returns a typed result indicating success/failure
   *
   * @param code - The JavaScript code to execute (should be an IIFE returning a value)
   * @param logContext - Optional context string for logging errors
   * @returns Object with success boolean, value (if successful), and error (if failed)
   */
  async safeExecuteJavaScript<T>(
    code: string,
    logContext?: string,
  ): Promise<{ success: true; value: T } | { success: false; error: string }> {
    const webview = this.getWebview();
    if (!webview) {
      const errorMsg = "Webview is not available";
      if (logContext) {
        this.log(logContext, errorMsg);
      }
      return { success: false, error: errorMsg };
    }

    try {
      const result = await webview.executeJavaScript(code);
      return { success: true, value: result as T };
    } catch (error) {
      const errorMsg = `${error}`;
      if (logContext) {
        this.log(logContext, `Error: ${errorMsg}`);
      }
      return { success: false, error: errorMsg };
    }
  }

  async waitForLoadingToFinish(timeout: number = DEFAULT_TIMEOUT) {
    this.log("waitForLoadingToFinish", "waiting for loading to finish");
    const startTime = Date.now();
    do {
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if operation was cancelled (e.g., user clicked archive-only)
      if (this.cancelWaitForURL) {
        this.log("waitForLoadingToFinish", "cancelled by user action");
        this.getWebview()?.stop();
        return;
      }

      if (Date.now() - startTime >= timeout) {
        this.log(
          "waitForLoadingToFinish",
          "timeout reached while waiting for loading to finish",
        );
        // Force stop any navigation before returning
        this.getWebview()?.stop();
        return;
      }
    } while (this.getWebview()?.isLoading());
    this.log("waitForLoadingToFinish", "loading finished");
  }

  async getScrollHeight() {
    return await this.getWebview()?.executeJavaScript(
      "document.body.scrollHeight",
    );
  }

  async waitForSelector(
    selector: string,
    startingURL: string = "",
    timeout: number = DEFAULT_TIMEOUT,
  ) {
    if (this.webview === null) {
      this.log("waitForSelector", "webview is null");
      return;
    }

    if (startingURL == "") {
      startingURL = this.webview.getURL();
    }

    const startTime = Date.now();
    while (true) {
      // Check if the URL has changed
      if (this.webview.getURL() !== startingURL) {
        this.log("waitForSelector", `URL changed: ${this.webview.getURL()}`);
        throw new URLChangedError(startingURL, this.webview.getURL());
      }

      // Check if we have timed out
      if (Date.now() - startTime > timeout) {
        throw new TimeoutError(selector);
      }

      // Did we find the selector?
      const found = await this.getWebview()?.executeJavaScript(
        `document.querySelector('${selector}') !== null`,
      );
      if (found) {
        this.log("waitForSelector", `found: ${selector}`);
        break;
      }
      await this.sleep(200);
    }
  }

  async doesSelectorExist(selector: string): Promise<boolean> {
    return await this.getWebview()?.executeJavaScript(
      `document.querySelector('${selector}') !== null`,
    );
  }

  // if the last element in the list of elements that match containerSelector, and check if selector exists
  async doesSelectorWithinElementLastExist(
    containerSelector: string,
    selector: string,
  ): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            const innerEl = lastEl.querySelector('${selector}');
            if(innerEl === null) { return false; }
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  async isSelectorLastDisabled(selector: string): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            return lastEl.disabled;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  async countSelectorsFound(selector: string): Promise<number> {
    return await this.getWebview()?.executeJavaScript(
      `document.querySelectorAll('${selector}').length`,
    );
  }

  // Count the number of selector elements within the last element in the list of elements that match containerSelector
  async countSelectorsWithinElementLastFound(
    containerSelector: string,
    selector: string,
  ): Promise<number> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return 0; }
            const lastEl = els[els.length - 1];
            const innerEls = lastEl.querySelectorAll('${selector}');
            return innerEls.length;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // wait for containerSelector to exist, and also selector within containerSelector to exist
  async waitForSelectorWithinSelector(
    containerSelector: string,
    selector: string,
    timeout: number = DEFAULT_TIMEOUT,
  ) {
    if (this.webview === null) {
      this.log("waitForSelector", "webview is null");
      return;
    }

    const startingURL = this.webview.getURL();

    const startTime = Date.now();
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new TimeoutError(selector);
      }
      const found = await this.getWebview()?.executeJavaScript(`
                (() => {
                    const el = document.querySelector('${containerSelector}');
                    if(el === null) { return false; }
                    const innerEl = el.querySelector('${selector}');
                    if(innerEl === null) { return false; }
                    return true;
                })()
            `);
      if (found) {
        this.log("waitForSelectorWithinSelector", `found: ${selector}`);
        break;
      }
      await this.sleep(200);

      // Check if the URL has changed
      if (this.webview.getURL() !== startingURL) {
        this.log(
          "waitForSelectorWithinSelector",
          `URL changed: ${this.webview.getURL()}`,
        );
        throw new URLChangedError(startingURL, this.webview.getURL());
      }
    }
  }

  async loadBlank() {
    this.log("loadBlank");
    const webview = this.getWebview();
    if (webview) {
      // Note: We need to wait for the page to finish loading before and after to prevent GUEST_VIEW_MANAGER_CALL
      // https://github.com/electron/electron/issues/24171#issuecomment-953053293
      await this.waitForLoadingToFinish();
      await webview.loadURL("about:blank");
      await this.waitForLoadingToFinish();
    }
  }

  async loadURL(url: string) {
    const webview = this.getWebview();
    if (webview) {
      // Note: We need to wait for the page to finish loading before and after to prevent GUEST_VIEW_MANAGER_CALL
      // https://github.com/electron/electron/issues/24171#issuecomment-953053293
      await this.waitForLoadingToFinish();

      let tries = 0;
      while (true) {
        try {
          this.log("loadURL", `try #${tries}, ${url}`);
          await webview.loadURL(url);
          // Sleep 2 seconds after loading each URL, to make everything more stable.
          // The X rate limits are intense, so this should not slow anything down.
          this.sleep(2000);
          this.log("loadURL", "URL loaded successfully");
          break;
        } catch (error) {
          // Check if this was a cancellation (user clicked archive-only, etc.)
          if (this.cancelWaitForURL) {
            this.log("loadURL", "Login cancelled");
            return; // Exit gracefully instead of throwing
          }

          this.log("loadURL", ["Failed to load URL", error]);
          tries++;
          if (tries >= 3) {
            if (await this.checkInternetConnectivity()) {
              throw error;
            } else {
              if (
                !(await window.electron.showQuestion(
                  `Error loading URL ${url}. It looks like your internet connection is down. Please check your connection and try again.`,
                  "Retry",
                  "Cancel",
                ))
              ) {
                throw new InternetDownError();
              } else {
                tries = 0;
                this.sleep(1000);
              }
            }
          } else {
            // Wait 1 second before retrying
            this.sleep(1000);
          }
        }
      }
    } else {
      this.log("loadURL", "webview is null");
    }

    await this.waitForLoadingToFinish();
  }

  async waitForURL(waitingForURL: string) {
    this.cancelWaitForURL = false;
    while (!this.cancelWaitForURL) {
      const newURL = this.getWebview()?.getURL();
      this.log("waitForURL", {
        waitingForURL: waitingForURL,
        currentURL: newURL,
      });

      // Check if we got the URL we were waiting for
      if (newURL?.startsWith(waitingForURL)) {
        break;
      }

      await this.sleep(250);
    }
  }

  // Return true if we scrolled, and false if we can't scroll anymore
  async scrollToBottom() {
    await this.waitForPause();

    // Find the last scroll position
    const scrollTop = await this.getWebview()?.executeJavaScript(
      "document.documentElement.scrollTop || document.body.scrollTop",
    );

    // Scroll to the bottom
    this.log("scrollToBottom", "scrolling to bottom");
    await this.getWebview()?.executeJavaScript(
      "window.scrollTo(0, document.body.scrollHeight)",
    );
    await this.sleep(1000);
    await this.waitForLoadingToFinish();

    // Have we scrolled?
    const newScrollTop = await this.getWebview()?.executeJavaScript(
      "document.documentElement.scrollTop || document.body.scrollTop",
    );
    if (newScrollTop === scrollTop) {
      return false;
    }
    return true;
  }

  // Return true if we scrolled, and false if we can't scroll anymore
  async scrollToTop(selector: string) {
    // Find the last scroll position
    const scrollTop = await this.getWebview()?.executeJavaScript(`
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            return el.scrollTop;
        })()
        `);

    await this.waitForLoadingToFinish();
    await this.sleep(500);

    // Scroll to the top
    this.log("scrollToTop", "scrolling to top");
    await this.getWebview()?.executeJavaScript(`
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            el.scrollTo(0,0);
        })()
        `);
    await this.sleep(500);
    await this.waitForLoadingToFinish();

    // Have we scrolled?
    const newScrollTop = await this.getWebview()?.executeJavaScript(`
            (() => {
                let el = document.querySelector('${selector}');
                if(el === null) { return false; }
                return el.scrollTop;
            })()
        `);
    if (newScrollTop === scrollTop) {
      return false;
    }
    return true;
  }

  async scrollUp(height: number) {
    await this.getWebview()?.executeJavaScript(
      `window.scrollBy(0, -${height})`,
    );
    await this.sleep(500);
    await this.waitForLoadingToFinish();
  }

  async scriptClickElement(selector: string): Promise<boolean> {
    const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            el.click();
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // click the Nth element in the list of elements that match selector
  async scriptClickElementNth(selector: string, n: number): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length < ${n + 1}) { return false; }
            const firstEl = els[${n}];
            firstEl.click()
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // click the first element in the list of elements that match selector
  async scriptClickElementFirst(selector: string): Promise<boolean> {
    return await this.scriptClickElementNth(selector, 0);
  }

  // click the last element in the list of elements that match selector
  async scriptClickElementLast(selector: string): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            lastEl.click()
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // if the first element in the list of elements that match containerSelector, and click selector
  async scriptClickElementWithinElementFirst(
    containerSelector: string,
    selector: string,
  ): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return false; }
            const firstEl = els[0];
            const innerEl = firstEl.querySelector('${selector}');
            if(innerEl === null) { return false; }
            innerEl.click();
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // if the last element in the list of elements that match containerSelector, and click selector
  async scriptClickElementWithinElementLast(
    containerSelector: string,
    selector: string,
  ): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            const innerEl = lastEl.querySelector('${selector}');
            if(innerEl === null) { return false; }
            innerEl.click();
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  async scriptMouseoverElement(selector: string): Promise<boolean> {
    const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // mouseover the Nth element in the list of elements that match selector
  async scriptMouseoverElementNth(
    selector: string,
    n: number,
  ): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length < ${n + 1}) { return false; }
            const firstEl = els[${n}];
            firstEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  // mouseover the first element in the list of elements that match selector
  async scriptMouseoverElementFirst(selector: string): Promise<boolean> {
    return await this.scriptMouseoverElementNth(selector, 0);
  }

  // mouseover the last element in the list of elements that match selector
  async scriptMouseoverElementLast(selector: string): Promise<boolean> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            lastEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            return true;
        })()
        `;
    await this.sleep(250);
    return await this.getWebview()?.executeJavaScript(code);
  }

  async scriptGetInnerText(selector: string): Promise<null | string> {
    const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return null; }
            return el.innerText;
        })()
        `;
    return await this.getWebview()?.executeJavaScript(code);
  }

  async scriptGetAllInnerHTML(selector: string): Promise<string[]> {
    const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            const elsHTML = Array.from(els).map(el => el.innerHTML);
            return elsHTML;
        })()
        `;
    return await this.getWebview()?.executeJavaScript(code);
  }

  /**
   * Click an element by XPath
   * Returns true if the element was found and clicked, false otherwise
   */
  async clickElementByXPath(xpath: string): Promise<boolean> {
    const webview = this.getWebview();
    if (!webview) return false;

    try {
      return await webview.executeJavaScript(`
        (() => {
          const result = document.evaluate(
            '${xpath}',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          const element = result.singleNodeValue;
          if (element) {
            element.click();
            return true;
          }
          return false;
        })()
      `);
    } catch (error) {
      this.log("clickElementByXPath", `Error clicking element: ${error}`);
      return false;
    }
  }

  async scriptSendClickInputEvent(selector: string): Promise<void> {
    // Get the coordinates of the element
    const code = `
        (() => {
            const el = document.querySelector('${selector}');
            const rect = el.getBoundingClientRect();
            return rect;
        })()
        `;
    const rect: DOMRect = await this.getWebview()?.executeJavaScript(code);
    const centerX = Math.round(rect.x + rect.width / 2);
    const centerY = Math.round(rect.y + rect.height / 2);

    // Create a new mouse event
    await this.getWebview()?.sendInputEvent({
      type: "mouseDown",
      x: centerX,
      y: centerY,
      button: "left",
      clickCount: 1,
    });
  }
}
