/**
 * Captures X's API traffic into a HAR while a walk happens, scripted or by
 * hand.
 *
 * Responses are read as they arrive and the file is rewritten as it goes.
 * Playwright's own `recordHar` writes only when the context closes, and writes
 * nothing at all if the browser window is closed first — which loses an entire
 * walk to a misplaced click.
 */

import fs from "fs";
import path from "path";

import type { BrowserContext, Page } from "playwright-core";

import { isXApiUrl } from "./har";

/** Rewritten this often, so that a lost browser costs at most this much. */
export const FLUSH_EVERY = 5;

interface HarHeaderOut {
  name: string;
  value: string;
}

interface HarEntryOut {
  startedDateTime: string;
  request: {
    method: string;
    url: string;
    headers: HarHeaderOut[];
    postData?: { mimeType: string; text: string };
  };
  response: {
    status: number;
    headers: HarHeaderOut[];
    content: { mimeType: string; text: string };
  };
}

function toHeaders(headers: Record<string, string>): HarHeaderOut[] {
  return Object.entries(headers).map(([name, value]) => ({ name, value }));
}

export class Recorder {
  private entries: HarEntryOut[] = [];
  private sinceFlush = 0;
  private graphql = 0;

  constructor(private harPath: string) {
    fs.mkdirSync(path.dirname(harPath), { recursive: true });
    this.write();
  }

  get count(): number {
    return this.entries.length;
  }

  /** What has been captured so far, for a walk that needs to look back. */
  get entriesSent(): HarEntryOut[] {
    return this.entries;
  }

  /**
   * GraphQL calls only. X polls its own endpoints for badge counts and the
   * like the whole time a page is open, so the total is never still and cannot
   * be used to tell whether a timeline has stopped fetching pages.
   */
  get graphqlCount(): number {
    return this.graphql;
  }

  add(entry: HarEntryOut) {
    this.entries.push(entry);
    if (entry.request.url.includes("/graphql/")) {
      this.graphql += 1;
    }
    this.sinceFlush += 1;
    if (this.sinceFlush >= FLUSH_EVERY) {
      this.write();
    }
  }

  write() {
    this.sinceFlush = 0;
    fs.writeFileSync(
      this.harPath,
      JSON.stringify(
        {
          log: {
            version: "1.2",
            creator: { name: "cyd-x-capture", version: "1.0" },
            entries: this.entries,
          },
        },
        null,
        2,
      ),
    );
  }
}

function watch(page: Page, recorder: Recorder) {
  page.on("response", async (response) => {
    const request = response.request();
    if (!isXApiUrl(request.url())) {
      return;
    }

    // Read the body now: it is at its most available the moment it arrives,
    // and a later navigation can discard it.
    let text = "";
    try {
      text = await response.text();
    } catch {
      text = "";
    }

    let requestHeaders: Record<string, string> = {};
    try {
      requestHeaders = await request.allHeaders();
    } catch {
      requestHeaders = request.headers();
    }

    const postData = request.postData();

    recorder.add({
      startedDateTime: new Date().toISOString(),
      request: {
        method: request.method(),
        url: request.url(),
        headers: toHeaders(requestHeaders),
        ...(postData
          ? { postData: { mimeType: "application/json", text: postData } }
          : {}),
      },
      response: {
        status: response.status(),
        headers: toHeaders(response.headers()),
        content: { mimeType: "application/json", text },
      },
    });

    if (process.stdout.isTTY) {
      process.stdout.write(`\r  captured ${recorder.count} X API calls   `);
    }
  });
}

export function attachToPages(context: BrowserContext, recorder: Recorder) {
  for (const page of context.pages()) {
    watch(page, recorder);
  }
  context.on("page", (page) => watch(page, recorder));
}
