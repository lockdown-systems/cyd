import fs from "fs";
import os from "os";
import path from "path";

import { describe, test, expect, beforeEach, afterEach } from "vitest";

import { RequestLog } from "./request_log";

describe("RequestLog", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyd-request-log-"));
  });

  afterEach(() => {
    delete process.env.CYD_REQUEST_LOG;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("records nothing unless the environment asks for it", () => {
    const requestLog = new RequestLog(1);

    expect(requestLog.enabled).toBe(false);

    requestLog.record({
      method: "POST",
      url: "https://upload.x.com/i/media/upload.json",
      statusCode: 201,
      fromCache: false,
    });

    expect(fs.readdirSync(dir)).toEqual([]);
  });

  test("appends one line per request, so a crash keeps what came before", () => {
    process.env.CYD_REQUEST_LOG = dir;
    const requestLog = new RequestLog(7);

    expect(requestLog.enabled).toBe(true);

    requestLog.record({
      method: "POST",
      url: "https://upload.x.com/i/media/upload.json",
      statusCode: 201,
      fromCache: false,
    });
    requestLog.record({
      method: "POST",
      url: "https://api.x.com/1.1/account/update_profile_banner.json",
      statusCode: 200,
      fromCache: false,
    });

    const lines = fs
      .readFileSync(path.join(dir, "account-7.jsonl"), "utf8")
      .trim()
      .split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      method: "POST",
      url: "https://upload.x.com/i/media/upload.json",
      statusCode: 201,
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      url: "https://api.x.com/1.1/account/update_profile_banner.json",
      statusCode: 200,
    });
    expect(JSON.parse(lines[0]).at).toEqual(expect.any(String));
  });

  test("keeps one account's traffic out of another's", () => {
    process.env.CYD_REQUEST_LOG = dir;

    new RequestLog(1).record({
      method: "GET",
      url: "https://x.com/one",
      statusCode: 200,
      fromCache: false,
    });
    new RequestLog(2).record({
      method: "GET",
      url: "https://x.com/two",
      statusCode: 200,
      fromCache: false,
    });

    expect(fs.readdirSync(dir).sort()).toEqual([
      "account-1.jsonl",
      "account-2.jsonl",
    ]);
  });

  test("a directory it cannot write to stops the log, not the run", () => {
    process.env.CYD_REQUEST_LOG = path.join(dir, "file-in-the-way");
    fs.writeFileSync(path.join(dir, "file-in-the-way"), "");

    const requestLog = new RequestLog(1);

    expect(requestLog.enabled).toBe(false);
    expect(() =>
      requestLog.record({
        method: "GET",
        url: "https://x.com/",
        statusCode: 200,
        fromCache: false,
      }),
    ).not.toThrow();
  });
});
