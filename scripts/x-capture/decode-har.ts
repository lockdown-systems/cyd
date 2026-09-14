/**
 * Decodes a HAR export of a capture session against X into per-operation JSON,
 * plus a written summary of the routes, GraphQL identifiers, referrers, and
 * rate-limit and empty-state signals observed.
 *
 * Usage:
 *   npx tsx scripts/x-capture/decode-har.ts <capture.har> [--out DIR]
 *
 * The raw HAR is never copied into the output, and no request headers other
 * than the referrer are kept, so the decoded output carries no session cookies
 * or authorization tokens. The raw HAR is not committed.
 */

import fs from "fs";
import path from "path";

import {
  decodeHar,
  fixtureFilename,
  type CaptureReport,
  type CapturedCall,
  type Har,
} from "./lib/har";

interface Options {
  harPath: string;
  outDir: string | null;
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  let harPath: string | null = null;
  let outDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") {
      outDir = args[++i] ?? null;
    } else if (args[i].startsWith("--")) {
      throw new Error(`Unknown option: ${args[i]}`);
    } else {
      harPath = args[i];
    }
  }

  if (harPath === null) {
    throw new Error(
      "Usage: npx tsx scripts/x-capture/decode-har.ts <capture.har> [--out DIR]",
    );
  }

  return { harPath, outDir };
}

function writeJSON(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`);
}

/** The bodies are written per operation, numbered in the order they arrived. */
function writeOperationBodies(report: CaptureReport, outDir: string) {
  const byOperation = new Map<string, CapturedCall[]>();
  for (const call of report.calls) {
    const calls = byOperation.get(call.operationName) ?? [];
    calls.push(call);
    byOperation.set(call.operationName, calls);
  }

  for (const [operationName, calls] of byOperation) {
    calls.forEach((call, index) => {
      const dir = path.join(outDir, "operations", operationName);
      const page = `${index + 1}`.padStart(2, "0");

      if (call.responseBody !== null) {
        writeJSON(path.join(dir, `${page}.json`), call.responseBody);
      } else if (call.responseText !== null) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${page}.txt`), call.responseText);
      }

      writeJSON(path.join(dir, `${page}.meta.json`), {
        index: call.index,
        startedDateTime: call.startedDateTime,
        method: call.method,
        url: call.url,
        route: call.route,
        queryId: call.queryId,
        status: call.status,
        referrer: call.referrer,
        requestBody: call.requestBody,
        errorMessages: call.errorMessages,
        successWithErrors: call.successWithErrors,
        rateLimit: call.rateLimit,
        emptyStateMarkers: call.emptyStateMarkers,
        limitedActions: call.limitedActions,
        typenames: call.typenames,
        entryCounts: call.entryCounts,
        suggestedFixtureName: fixtureFilename(
          operationName,
          report.dateStamp,
          index,
          calls.length,
        ),
      });
    });
  }
}

function summaryMarkdown(report: CaptureReport): string {
  const lines: string[] = [];

  lines.push(`# X capture ${report.dateStamp}`);
  lines.push("");
  lines.push(`- Captured at: ${report.capturedAt ?? "unknown"}`);
  lines.push(`- HAR entries: ${report.totalEntries}`);
  lines.push(`- X API calls: ${report.capturedEntries}`);
  lines.push("");

  lines.push("## Operations");
  lines.push("");
  lines.push("| Operation | Kind | Method | Calls | Route | Identifiers |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const operation of report.operations) {
    lines.push(
      `| ${operation.operationName} | ${operation.kind} | ${operation.methods.join(", ")} | ${operation.count} | ${operation.routes.join("<br>")} | ${operation.queryIds.join("<br>") || "—"} |`,
    );
  }
  lines.push("");

  const mutations = report.operations.filter((operation) =>
    operation.methods.includes("POST"),
  );
  lines.push("## Referrers sent with POST operations");
  lines.push("");
  if (mutations.length === 0) {
    lines.push("None captured.");
  } else {
    lines.push("| Operation | Referrers |");
    lines.push("| --- | --- |");
    for (const operation of mutations) {
      lines.push(
        `| ${operation.operationName} | ${operation.referrers.join("<br>") || "—"} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Rate limits reported inside a successful response");
  lines.push("");
  const disguised = report.calls.filter((call) => call.successWithErrors);
  if (disguised.length === 0) {
    lines.push("None captured.");
  } else {
    for (const call of disguised) {
      lines.push(
        `- \`${call.operationName}\` HTTP ${call.status}: ${call.errorMessages.join("; ")}`,
      );
    }
  }
  lines.push("");

  lines.push("## Empty-state signals");
  lines.push("");
  const empties = report.calls.filter(
    (call) => call.emptyStateMarkers.length > 0,
  );
  if (empties.length === 0) {
    lines.push("None captured.");
  } else {
    for (const call of empties) {
      lines.push(
        `- \`${call.operationName}\`: ${call.emptyStateMarkers.join(", ")}`,
      );
    }
  }
  lines.push("");

  lines.push("## Actions X has disabled on captured posts");
  lines.push("");
  const limited = report.calls.filter((call) => call.limitedActions.length > 0);
  if (limited.length === 0) {
    lines.push("None captured.");
  } else {
    for (const call of limited) {
      lines.push(
        `- \`${call.operationName}\`: ${call.limitedActions.join("; ")}`,
      );
    }
  }
  lines.push("");

  lines.push("## Response types seen");
  lines.push("");
  const allTypes: Record<string, number> = {};
  for (const call of report.calls) {
    for (const [name, count] of Object.entries(call.typenames)) {
      allTypes[name] = (allTypes[name] ?? 0) + count;
    }
  }
  const typeNames = Object.keys(allTypes).sort();
  if (typeNames.length === 0) {
    lines.push("None captured.");
  } else {
    lines.push("| Type | Count |");
    lines.push("| --- | --- |");
    for (const name of typeNames) {
      lines.push(`| ${name} | ${allTypes[name]} |`);
    }
  }
  lines.push("");

  lines.push("## Timeline entry counts");
  lines.push("");
  lines.push("| Operation | Call | Entries |");
  lines.push("| --- | --- | --- |");
  for (const call of report.calls) {
    const counts = Object.entries(call.entryCounts);
    if (counts.length === 0) {
      continue;
    }
    lines.push(
      `| ${call.operationName} | ${call.index} | ${counts.map(([prefix, count]) => `${prefix}: ${count}`).join(", ")} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv);
  const har = JSON.parse(fs.readFileSync(options.harPath, "utf8")) as Har;
  const report = decodeHar(har);

  const outDir =
    options.outDir ?? path.join("capture", report.dateStamp, "decoded");
  fs.mkdirSync(outDir, { recursive: true });

  writeOperationBodies(report, outDir);
  writeJSON(path.join(outDir, "calls.json"), {
    capturedAt: report.capturedAt,
    dateStamp: report.dateStamp,
    totalEntries: report.totalEntries,
    capturedEntries: report.capturedEntries,
    operations: report.operations,
    calls: report.calls.map((call) => ({
      index: call.index,
      operationName: call.operationName,
      method: call.method,
      route: call.route,
      queryId: call.queryId,
      status: call.status,
      referrer: call.referrer,
      successWithErrors: call.successWithErrors,
      emptyStateMarkers: call.emptyStateMarkers,
      limitedActions: call.limitedActions,
      entryCounts: call.entryCounts,
    })),
  });
  fs.writeFileSync(path.join(outDir, "SUMMARY.md"), summaryMarkdown(report));

  console.log(summaryMarkdown(report));
  console.log(`Decoded ${report.capturedEntries} X API calls into ${outDir}`);
}

main();
