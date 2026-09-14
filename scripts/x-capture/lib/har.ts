/**
 * Decodes a HAR export of a browser session against X into per-operation
 * records, so that a capture session can be turned into test fixtures and into
 * a written record of X's current routes, GraphQL operations, and responses.
 *
 * This is capture tooling, not application code. It runs from
 * `scripts/x-capture/decode-har.ts` and never ships inside Cyd.
 */

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarEntry {
  startedDateTime?: string;
  request: {
    method: string;
    url: string;
    headers?: HarHeader[];
    postData?: { mimeType?: string; text?: string };
  };
  response: {
    status: number;
    headers?: HarHeader[];
    content?: { mimeType?: string; text?: string; encoding?: string };
  };
}

export interface Har {
  log: { entries: HarEntry[] };
}

export interface CapturedRateLimit {
  limit?: string;
  remaining?: string;
  reset?: string;
}

export interface CapturedCall {
  /** Position in the HAR, so a call can be traced back to the raw export. */
  index: number;
  startedDateTime: string | null;
  method: string;
  url: string;
  host: string;
  route: string;
  kind: "graphql" | "rest";
  operationName: string;
  /** The rotating GraphQL identifier in the path, when the call is GraphQL. */
  queryId: string | null;
  status: number;
  /** The referrer X's own client sent, which delete mutations depend on. */
  referrer: string | null;
  requestBody: unknown;
  responseBody: unknown;
  /** Set when the response body was not JSON. */
  responseText: string | null;
  errorMessages: string[];
  /** A successful HTTP status carrying an error array: the disguised failure. */
  successWithErrors: boolean;
  rateLimit: CapturedRateLimit | null;
  emptyStateMarkers: string[];
  /** Actions X has refused on a post, with the reason it gives. */
  limitedActions: string[];
  /** Every GraphQL type in the response, with how often it appears. */
  typenames: Record<string, number>;
  entryCounts: Record<string, number>;
}

export interface OperationSummary {
  operationName: string;
  kind: "graphql" | "rest";
  routes: string[];
  methods: string[];
  queryIds: string[];
  referrers: string[];
  statuses: number[];
  count: number;
  successWithErrorsCount: number;
}

export interface CaptureReport {
  capturedAt: string | null;
  dateStamp: string;
  totalEntries: number;
  capturedEntries: number;
  calls: CapturedCall[];
  operations: OperationSummary[];
  /** Indexes of calls that look like a rate limit reported inside a 200. */
  rateLimitCandidates: number[];
}

const X_HOSTS = [
  "x.com",
  "api.x.com",
  "mobile.x.com",
  "twitter.com",
  "api.twitter.com",
];

const API_PATH_MARKERS = ["/graphql/", "/i/api/", "/1.1/", "/2/"];

export function isXApiUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!X_HOSTS.includes(parsed.hostname)) {
    return false;
  }
  return API_PATH_MARKERS.some((marker) => parsed.pathname.includes(marker));
}

export interface ParsedOperation {
  kind: "graphql" | "rest";
  operationName: string;
  queryId: string | null;
  route: string;
  host: string;
}

/**
 * Pulls the operation name and the rotating identifier out of a request URL.
 *
 * GraphQL calls look like `/i/api/graphql/<queryId>/<OperationName>`, so the
 * identifier and the name are both carried in the path. REST calls are named
 * after their path so that they sort alongside the GraphQL ones.
 */
export function parseXOperation(url: string): ParsedOperation | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
  const graphqlIndex = segments.indexOf("graphql");

  if (graphqlIndex !== -1 && segments.length > graphqlIndex + 2) {
    return {
      kind: "graphql",
      operationName: segments[graphqlIndex + 2],
      queryId: segments[graphqlIndex + 1],
      route: parsed.pathname,
      host: parsed.hostname,
    };
  }

  const versionIndex = segments.findIndex((s) => s === "1.1" || s === "2");
  const restSegments =
    versionIndex === -1 ? segments : segments.slice(versionIndex + 1);
  const operationName = restSegments
    .join("_")
    .replace(/\.json$/, "")
    .replace(/[^A-Za-z0-9_]/g, "_");

  return {
    kind: "rest",
    operationName: operationName || "unknown",
    queryId: null,
    route: parsed.pathname,
    host: parsed.hostname,
  };
}

function headerValue(headers: HarHeader[] | undefined, name: string) {
  const match = headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  );
  return match ? match.value : null;
}

function parseJSON(text: string | null | undefined): unknown {
  if (text === null || text === undefined || text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function walkJSON(
  value: unknown,
  visit: (key: string, value: unknown) => void,
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkJSON(item, visit);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visit(key, child);
      walkJSON(child, visit);
    }
  }
}

/**
 * Counts timeline entries by their `entryId` prefix, which is how a response
 * carrying only cursors is told apart from one carrying posts.
 */
export function countTimelineEntries(body: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  walkJSON(body, (key, value) => {
    if (key !== "entryId" || typeof value !== "string") {
      return;
    }
    const prefix = value.split("-")[0] || "unknown";
    counts[prefix] = (counts[prefix] ?? 0) + 1;
  });
  return counts;
}

/**
 * Counts the GraphQL types in a response. This is the cheapest description of
 * a response's shape, and it answers questions a count of entries cannot:
 * whether a deleted post leaves a `TweetTombstone` or `TweetUnavailable`
 * behind, and whether posts still arrive as the type the parser expects.
 */
export function countTypenames(body: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  walkJSON(body, (key, value) => {
    if (key === "__typename" && typeof value === "string") {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  });
  return counts;
}

const EMPTY_STATE_PATTERN = /no.?result|empty.?state|zero.?result/i;

/**
 * Collects the explicit empty-state signals a timeline response carries, so
 * that "the account really is empty" can be told apart from "parsing failed".
 */
export function collectEmptyStateMarkers(body: unknown): string[] {
  const markers = new Set<string>();
  walkJSON(body, (key, value) => {
    // X has signalled an empty timeline through the key as well as the value,
    // so a key named for the absence of results counts even when its value is
    // an object.
    if (EMPTY_STATE_PATTERN.test(key)) {
      markers.add(`${key}`);
    }
    if (typeof value === "string" && EMPTY_STATE_PATTERN.test(value)) {
      markers.add(`${key}=${value}`);
    }
  });
  return [...markers].sort();
}

/**
 * Collects the actions X has disabled on a post. X carries these in
 * `limitedActionResults.limited_actions[]`, naming actions such as `Retweet`
 * and `QuoteTweet` alongside the prompt it shows the user. This is the
 * server-side reason a control is greyed out, and a mutation against such a
 * post is one X will refuse.
 */
export function collectLimitedActions(body: unknown): string[] {
  const limited = new Set<string>();

  walkJSON(body, (key, value) => {
    if (key !== "limited_actions" || !Array.isArray(value)) {
      return;
    }
    for (const entry of value) {
      if (entry === null || typeof entry !== "object") {
        continue;
      }
      const action = (entry as { action?: unknown }).action;
      if (typeof action !== "string") {
        continue;
      }
      const prompt = (entry as { prompt?: { headline?: { text?: unknown } } })
        .prompt;
      const headline = prompt?.headline?.text;
      limited.add(
        typeof headline === "string" ? `${action}: ${headline}` : action,
      );
    }
  });

  return [...limited].sort();
}

function collectErrorMessages(body: unknown): string[] {
  if (body === null || typeof body !== "object") {
    return [];
  }
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((error) => {
    if (error !== null && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      const code = (error as { code?: unknown }).code;
      if (typeof message === "string") {
        return code === undefined ? message : `${code}: ${message}`;
      }
    }
    return JSON.stringify(error);
  });
}

function readRateLimit(headers: HarHeader[] | undefined) {
  const limit = headerValue(headers, "x-rate-limit-limit");
  const remaining = headerValue(headers, "x-rate-limit-remaining");
  const reset = headerValue(headers, "x-rate-limit-reset");
  if (limit === null && remaining === null && reset === null) {
    return null;
  }
  const rateLimit: CapturedRateLimit = {};
  if (limit !== null) rateLimit.limit = limit;
  if (remaining !== null) rateLimit.remaining = remaining;
  if (reset !== null) rateLimit.reset = reset;
  return rateLimit;
}

export function dateStampFrom(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Builds a fixture filename following the existing dated convention in
 * `testdata/x/`, for example `XUserTweetsAndReplies_20250404.json`. Multiple
 * pages of the same operation are numbered.
 */
export function fixtureFilename(
  operationName: string,
  dateStamp: string,
  index = 0,
  total = 1,
): string {
  const base = operationName.startsWith("X")
    ? operationName
    : `X${operationName}`;
  if (total <= 1) {
    return `${base}_${dateStamp}.json`;
  }
  return `${base}_${dateStamp}_${index + 1}.json`;
}

function decodeEntry(entry: HarEntry, index: number): CapturedCall | null {
  const operation = parseXOperation(entry.request.url);
  if (operation === null) {
    return null;
  }

  const responseText = entry.response.content?.text ?? null;
  const responseBody = parseJSON(responseText);
  const requestText = entry.request.postData?.text ?? null;
  const requestBody = parseJSON(requestText) ?? requestText;
  const errorMessages = collectErrorMessages(responseBody);
  const status = entry.response.status;

  return {
    index,
    startedDateTime: entry.startedDateTime ?? null,
    method: entry.request.method,
    url: entry.request.url,
    host: operation.host,
    route: operation.route,
    kind: operation.kind,
    operationName: operation.operationName,
    queryId: operation.queryId,
    status,
    referrer: headerValue(entry.request.headers, "referer"),
    requestBody,
    responseBody,
    responseText: responseBody === null ? responseText : null,
    errorMessages,
    successWithErrors:
      status >= 200 && status < 300 && errorMessages.length > 0,
    rateLimit: readRateLimit(entry.response.headers),
    emptyStateMarkers: collectEmptyStateMarkers(responseBody),
    limitedActions: collectLimitedActions(responseBody),
    typenames: countTypenames(responseBody),
    entryCounts: countTimelineEntries(responseBody),
  };
}

function summarize(calls: CapturedCall[]): OperationSummary[] {
  const byOperation = new Map<string, OperationSummary>();

  for (const call of calls) {
    let summary = byOperation.get(call.operationName);
    if (summary === undefined) {
      summary = {
        operationName: call.operationName,
        kind: call.kind,
        routes: [],
        methods: [],
        queryIds: [],
        referrers: [],
        statuses: [],
        count: 0,
        successWithErrorsCount: 0,
      };
      byOperation.set(call.operationName, summary);
    }

    summary.count += 1;
    if (call.successWithErrors) {
      summary.successWithErrorsCount += 1;
    }
    if (!summary.routes.includes(call.route)) summary.routes.push(call.route);
    if (!summary.methods.includes(call.method))
      summary.methods.push(call.method);
    if (call.queryId !== null && !summary.queryIds.includes(call.queryId)) {
      summary.queryIds.push(call.queryId);
    }
    if (call.referrer !== null && !summary.referrers.includes(call.referrer)) {
      summary.referrers.push(call.referrer);
    }
    if (!summary.statuses.includes(call.status))
      summary.statuses.push(call.status);
  }

  return [...byOperation.values()].sort((a, b) =>
    a.operationName.localeCompare(b.operationName),
  );
}

export function decodeHar(har: Har): CaptureReport {
  const entries = har.log?.entries ?? [];
  const calls: CapturedCall[] = [];

  entries.forEach((entry, index) => {
    if (!isXApiUrl(entry.request.url)) {
      return;
    }
    const call = decodeEntry(entry, index);
    if (call !== null) {
      calls.push(call);
    }
  });

  const timestamps = calls
    .map((call) => call.startedDateTime)
    .filter((value): value is string => value !== null)
    .sort();
  const capturedAt = timestamps[0] ?? null;
  const capturedDate = capturedAt === null ? new Date() : new Date(capturedAt);

  return {
    capturedAt,
    dateStamp: dateStampFrom(
      isNaN(capturedDate.getTime()) ? new Date() : capturedDate,
    ),
    totalEntries: entries.length,
    capturedEntries: calls.length,
    calls,
    operations: summarize(calls),
    rateLimitCandidates: calls
      .filter((call) => call.successWithErrors)
      .map((call) => call.index),
  };
}
