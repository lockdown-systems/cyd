/**
 * Copies chosen decoded operations out of a capture into `testdata/x/`, using
 * the existing dated filename convention, so that only the fixtures the tests
 * actually need are committed.
 *
 * Usage:
 *   npx tsx scripts/x-capture/promote-fixture.ts <decoded/operations/Op/01.json> [more...]
 *     [--name OperationName] [--date YYYYMMDD] [--force]
 */

import fs from "fs";
import path from "path";

import { fixtureAccessorName, fixtureFilename } from "./lib/har";

interface Options {
  sources: string[];
  name: string | null;
  date: string | null;
  force: boolean;
}

const TESTDATA_DIR = path.join("testdata", "x");

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = {
    sources: [],
    name: null,
    date: null,
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name") {
      options.name = args[++i] ?? null;
    } else if (args[i] === "--date") {
      options.date = args[++i] ?? null;
    } else if (args[i] === "--force") {
      options.force = true;
    } else if (args[i].startsWith("--")) {
      throw new Error(`Unknown option: ${args[i]}`);
    } else {
      options.sources.push(args[i]);
    }
  }

  if (options.sources.length === 0) {
    throw new Error(
      "Usage: npx tsx scripts/x-capture/promote-fixture.ts <decoded/operations/Op/01.json> [more...] [--name Op] [--date YYYYMMDD]",
    );
  }

  return options;
}

/** A decoded body sits at `<capture>/operations/<OperationName>/<page>.json`. */
function operationNameFor(source: string, override: string | null): string {
  if (override !== null) {
    return override;
  }
  return path.basename(path.dirname(source));
}

/** The capture is dated by the meta file the decoder wrote beside the body. */
function dateStampFor(source: string, override: string | null): string {
  if (override !== null) {
    return override;
  }

  const metaPath = source.replace(/\.json$/, ".meta.json");
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      suggestedFixtureName?: string;
    };
    const match = meta.suggestedFixtureName?.match(/_(\d{8})(?:_\d+)?\.json$/);
    if (match) {
      return match[1];
    }
  }

  throw new Error(
    `Cannot determine the capture date for ${source}. Pass --date YYYYMMDD.`,
  );
}

function main() {
  const options = parseArgs(process.argv);
  const total = options.sources.length;

  options.sources.forEach((source, index) => {
    const operationName = operationNameFor(source, options.name);
    const dateStamp = dateStampFor(source, options.date);
    const filename = fixtureFilename(operationName, dateStamp, index, total);
    const destination = path.join(TESTDATA_DIR, filename);

    if (fs.existsSync(destination) && !options.force) {
      throw new Error(
        `${destination} already exists. Pass --force to replace.`,
      );
    }

    fs.copyFileSync(source, destination);
    console.log(`${source} -> ${destination}`);
    console.log(
      `  add to test_fixtures.ts: ${fixtureAccessorName(operationName, dateStamp, index, total)}: () => loadFixture("${filename}"),`,
    );
  });
}

main();
