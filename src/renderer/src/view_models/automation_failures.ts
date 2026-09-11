/**
 * Failures raised while driving a platform through an embedded browser. They
 * are ordinary errors with no webview in them, so the jobs that catch them can
 * live anywhere.
 */

export class TimeoutError extends Error {
  constructor(selector: string) {
    super(`Timeout waiting for selector: ${selector}`);
    this.name = "TimeoutError";
  }
}

export class URLChangedError extends Error {
  constructor(oldURL: string, newURL: string, validURLs: string[] = []) {
    let errorMessage = `URL changed from ${oldURL} to ${newURL}`;
    if (validURLs.length > 0) {
      errorMessage += ` (valid URLs: ${validURLs.join(", ")})`;
    }
    super(errorMessage);
    this.name = "URLChangedError";
  }
}

export class InternetDownError extends Error {
  constructor() {
    super(`Internet connection is down`);
    this.name = "InternetDownError";
  }
}
