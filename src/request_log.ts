/**
 * Records the requests a platform's session makes, so a run that has already
 * failed can still be worked out afterwards.
 *
 * The capture tooling in `scripts/x-capture/` answers questions by driving a
 * separate Chromium, which means its findings are about Chromium. When the app
 * behaves differently from the probe — a banner that uploads under Playwright
 * and does not under Electron — there is nothing to compare, because only one
 * of the two is being watched. This watches the other one.
 *
 * Off unless `CYD_REQUEST_LOG` names a directory to write to:
 *
 *   CYD_REQUEST_LOG=/tmp/cyd-requests npm start
 *
 * What it records is the traffic of a signed-in session, so it stays where
 * whoever is debugging put it. It is never attached to an error report and
 * never leaves the machine. To keep it that way it holds no bodies, no
 * headers, and no cookies — a method, a URL, and a status say whether a call
 * was made and what came back, which is the question worth asking, and none of
 * them carry the session.
 */

import fs from "fs";
import path from "path";

import log from "electron-log/main";

export interface RequestLogEntry {
  method: string;
  url: string;
  statusCode: number;
  fromCache: boolean;
}

export class RequestLog {
  private logPath: string | null = null;

  constructor(accountID: number) {
    const dir = process.env.CYD_REQUEST_LOG;
    if (dir === undefined || dir.trim() === "") {
      return;
    }

    try {
      fs.mkdirSync(dir, { recursive: true });
      this.logPath = path.join(dir, `account-${accountID}.jsonl`);
    } catch (error) {
      // A debugging aid that cannot write is worth a line in the log and
      // nothing more. It must not take the run down with it.
      log.error("RequestLog: could not open the request log:", error);
    }
  }

  get enabled(): boolean {
    return this.logPath !== null;
  }

  /**
   * Appended a line at a time, because the runs worth reading this back for
   * are the ones that did not reach the end.
   */
  record(entry: RequestLogEntry): void {
    if (this.logPath === null) {
      return;
    }

    try {
      fs.appendFileSync(
        this.logPath,
        `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
      );
    } catch (error) {
      log.error("RequestLog: could not record a request:", error);
    }
  }
}
