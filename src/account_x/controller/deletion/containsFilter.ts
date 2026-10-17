// The "only if they contain ..." delete filter.
//
// The match is case-insensitive and on whole words, so "Coffee" matches
// "#Coffee" and "hot coffee: Coffee!" but not "CoffeeBot". A "*"
// stands for the rest of a word, so "Coffee*" also matches "CoffeeBot"
// and "coffeeTHIS". Everything else the user types is taken literally.
//
// SQLite's LIKE can't express word boundaries, so the match is a function
// registered on the account database (see registerContainsFilterFunction), and
// the counts, the preview and the delete all go through it.

import type Database from "better-sqlite3";

export const CONTAINS_FILTER_FUNCTION = "cyd_text_matches";

const WORD_CHAR = "[\\p{L}\\p{N}_]";
const WORD_CHAR_RE = new RegExp(WORD_CHAR, "u");

// Each "*" lets the pattern try every split of a word, so a handful of them
// against a long word can take effectively forever. Runs of stars count as one,
// and a filter with more than this many is rejected (it matches nothing).
export const MAX_CONTAINS_FILTER_WILDCARDS = 3;

function collapseWildcards(text: string): string {
  return text.trim().replace(/\*+/g, "*");
}

export function containsFilterHasTooManyWildcards(text: string): boolean {
  const stars = collapseWildcards(text).match(/\*/g);
  return (stars?.length ?? 0) > MAX_CONTAINS_FILTER_WILDCARDS;
}

// True when there is nothing to look for. Stars alone don't count, since "*"
// would match every post.
export function isEmptyContainsFilterText(text: string): boolean {
  return text.replace(/\*/g, "").trim() === "";
}

export function buildContainsFilterRegExp(text: string): RegExp {
  const term = collapseWildcards(text);
  const body = term
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join(`${WORD_CHAR}*`);

  // Only anchor to a word edge on a side that starts or ends with a word
  // character, so "#Coffee" and "@someone" don't need a letter before them
  const first = term[0];
  const last = term[term.length - 1];
  const before = WORD_CHAR_RE.test(first) ? `(?<!${WORD_CHAR})` : "";
  const after = WORD_CHAR_RE.test(last) ? `(?!${WORD_CHAR})` : "";

  return new RegExp(`${before}${body}${after}`, "iu");
}

export function containsFilterMatches(
  text: string | null,
  filterText: string,
): boolean {
  if (
    text === null ||
    isEmptyContainsFilterText(filterText) ||
    containsFilterHasTooManyWildcards(filterText)
  ) {
    return false;
  }
  return buildContainsFilterRegExp(filterText).test(text);
}

// Registers the match as an SQL function. The compiled pattern is kept for the
// last filter text, since a query asks about every row with the same text.
export function registerContainsFilterFunction(db: Database.Database): void {
  let lastFilterText: string | null = null;
  let lastRegExp: RegExp | null = null;

  db.function(
    CONTAINS_FILTER_FUNCTION,
    { deterministic: true },
    (text: unknown, filterText: unknown): number => {
      if (typeof text !== "string" || typeof filterText !== "string") {
        return 0;
      }
      if (lastFilterText !== filterText || lastRegExp === null) {
        if (
          isEmptyContainsFilterText(filterText) ||
          containsFilterHasTooManyWildcards(filterText)
        ) {
          return 0;
        }
        lastRegExp = buildContainsFilterRegExp(filterText);
        lastFilterText = filterText;
      }
      return lastRegExp.test(text) ? 1 : 0;
    },
  );
}

// Returns an SQL condition for `column` and the parameter it binds, or null
// when the filter is disabled or empty (which means "no filter").
export function containsFilterCondition(
  column: string,
  enabled: boolean,
  text: string,
): { sql: string; param: string } | null {
  if (!enabled || isEmptyContainsFilterText(text)) {
    return null;
  }
  return {
    sql: `${CONTAINS_FILTER_FUNCTION}(${column}, ?) = 1`,
    param: text.trim(),
  };
}
