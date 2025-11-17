import fs from "fs";
import path from "path";

import type { Account, ResponseData } from "../../shared_types";
import type { IMITMController } from "../../mitm";

export interface FixtureResponseConfig {
  relativePath: string;
  url: string;
  host?: string;
  status?: number;
  headers?: Record<string, string | string[]>;
  requestBody?: string;
}

export interface TestMITMControllerOptions {
  fixturesRoot?: string;
}

export class TestMITMController implements IMITMController {
  public account: Account | null = null;
  public responseData: ResponseData[] = [];
  protected fixturesRoot: string;

  constructor(options: TestMITMControllerOptions = {}) {
    this.fixturesRoot =
      options.fixturesRoot ??
      path.resolve(__dirname, "..", "..", "..", "testdata");
  }

  async startMITM(): Promise<boolean> {
    return true;
  }

  async stopMITM(): Promise<void> {
    return;
  }

  async startMonitoring(): Promise<void> {
    return;
  }

  async stopMonitoring(): Promise<void> {
    return;
  }

  async clearProcessed(): Promise<void> {
    this.responseData = this.responseData.filter((item) => !item.processed);
  }

  protected readFixture(relativePath: string): string {
    const resolved = path.join(this.fixturesRoot, relativePath);
    return fs.readFileSync(resolved, "utf8");
  }

  protected readJSONFixture<T>(relativePath: string): T {
    return JSON.parse(this.readFixture(relativePath)) as T;
  }

  protected buildResponseDataFromFixture(
    config: FixtureResponseConfig,
  ): ResponseData {
    return {
      host: config.host ?? "x.com",
      url: config.url,
      status: config.status ?? 200,
      requestBody: config.requestBody ?? "",
      responseHeaders: config.headers ?? {},
      responseBody: this.readFixture(config.relativePath),
      processed: false,
    };
  }

  protected loadResponseSequence(
    sequence: FixtureResponseConfig[],
  ): ResponseData[] {
    return sequence.map((entry) => this.buildResponseDataFromFixture(entry));
  }
}
