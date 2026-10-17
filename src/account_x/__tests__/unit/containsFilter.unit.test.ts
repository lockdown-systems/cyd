import { describe, test, expect } from "vitest";

import {
  containsFilterCondition,
  containsFilterHasTooManyWildcards,
  containsFilterMatches,
  isEmptyContainsFilterText,
} from "../../controller/deletion/containsFilter";

describe("containsFilterMatches", () => {
  test("matches a whole word regardless of case", () => {
    expect(containsFilterMatches("Drinking coffee now", "Coffee")).toBe(true);
    expect(containsFilterMatches("COFFEE", "coffee")).toBe(true);
  });

  test("matches the word inside a hashtag, mention, or punctuation", () => {
    expect(containsFilterMatches("#Coffee - Fresh Cup", "Coffee")).toBe(true);
    expect(containsFilterMatches("hey @Coffee!", "Coffee")).toBe(true);
    expect(containsFilterMatches("(coffee)", "Coffee")).toBe(true);
    expect(containsFilterMatches("#coffee\n\nnext line", "Coffee")).toBe(true);
  });

  test("does not match when the word is part of a longer word", () => {
    expect(containsFilterMatches("@CoffeeBot hi", "Coffee")).toBe(false);
    expect(containsFilterMatches("#CoffeeNow", "Coffee")).toBe(false);
    expect(containsFilterMatches("uncoffee", "Coffee")).toBe(false);
  });

  test("a trailing star matches the rest of a word", () => {
    const filter = "Coffee*";
    expect(containsFilterMatches("#Coffee", filter)).toBe(true);
    expect(containsFilterMatches("@CoffeeBot", filter)).toBe(true);
    expect(containsFilterMatches("Coffeebla", filter)).toBe(true);
    expect(containsFilterMatches("coffeeTHIS", filter)).toBe(true);
    expect(containsFilterMatches("cof fee", filter)).toBe(false);
  });

  test("a leading star matches the start of a word", () => {
    expect(containsFilterMatches("the BestCoffee", "*Coffee")).toBe(true);
    expect(containsFilterMatches("Coffee", "*Coffee")).toBe(true);
    expect(containsFilterMatches("CoffeeBot", "*Coffee")).toBe(false);
  });

  test("a star in the middle matches letters, not spaces", () => {
    expect(containsFilterMatches("Now-Playing now_bot", "now*bot")).toBe(true);
    expect(containsFilterMatches("nowandbot", "now*bot")).toBe(true);
    expect(containsFilterMatches("now and bot", "now*bot")).toBe(false);
  });

  test("a term that starts with # or @ needs no word edge before it", () => {
    expect(containsFilterMatches("so#Coffee", "#Coffee")).toBe(true);
    expect(containsFilterMatches("hey @someone", "@someone")).toBe(true);
    expect(containsFilterMatches("hey @someoneelse", "@someone")).toBe(false);
  });

  test("takes everything else literally, including regex and SQL wildcards", () => {
    expect(containsFilterMatches("it is 100% sure", "100%")).toBe(true);
    expect(containsFilterMatches("it is 1000 sure", "100%")).toBe(false);
    expect(containsFilterMatches("a_b", "a_b")).toBe(true);
    expect(containsFilterMatches("axb", "a_b")).toBe(false);
    expect(containsFilterMatches("cost $5 (approx)", "$5 (approx)")).toBe(true);
    expect(containsFilterMatches("a.b", "a.b")).toBe(true);
    expect(containsFilterMatches("axb", "a.b")).toBe(false);
    expect(containsFilterMatches("back\\slash", "back\\slash")).toBe(true);
  });

  test("matches phrases with spaces", () => {
    expect(containsFilterMatches("Hot Coffee: a cup", "hot coffee")).toBe(true);
    expect(containsFilterMatches("Hot  Coffee", "hot coffee")).toBe(false);
  });

  test("handles accented and non-latin words", () => {
    expect(containsFilterMatches("Café del Mar", "café")).toBe(true);
    expect(containsFilterMatches("Cafés", "café")).toBe(false);
    expect(containsFilterMatches("音楽 を聴く", "音楽")).toBe(true);
  });

  test("ignores whitespace around the filter text", () => {
    expect(containsFilterMatches("#Coffee", "  Coffee  ")).toBe(true);
  });

  test("never matches null text or an empty filter", () => {
    expect(containsFilterMatches(null, "Coffee")).toBe(false);
    expect(containsFilterMatches("anything", "")).toBe(false);
    expect(containsFilterMatches("anything", "   ")).toBe(false);
    expect(containsFilterMatches("anything", "*")).toBe(false);
    expect(containsFilterMatches("anything", " ** ")).toBe(false);
  });
});

describe("wildcard limit", () => {
  test("stars in a row count as one", () => {
    expect(containsFilterHasTooManyWildcards("a***b")).toBe(false);
    expect(containsFilterMatches("axxb", "a***b")).toBe(true);
  });

  test("allows up to the limit and rejects more", () => {
    expect(containsFilterHasTooManyWildcards("*a*b*c")).toBe(false);
    expect(containsFilterHasTooManyWildcards("*a*b*c*")).toBe(true);
  });

  test("a filter over the limit matches nothing", () => {
    expect(containsFilterMatches("abcde", "a*b*c*d*e")).toBe(false);
    expect(containsFilterCondition("text", true, "a*b*c*d*e")).not.toBeNull();
  });

  test("the worst case at the limit finishes quickly", () => {
    const text = "a".repeat(300) + "c";
    const start = Date.now();
    expect(containsFilterMatches(text, "a*a*a*b")).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("isEmptyContainsFilterText", () => {
  test("is empty for blanks and for stars alone", () => {
    expect(isEmptyContainsFilterText("")).toBe(true);
    expect(isEmptyContainsFilterText("   ")).toBe(true);
    expect(isEmptyContainsFilterText("*")).toBe(true);
    expect(isEmptyContainsFilterText(" * * ")).toBe(true);
  });

  test("is not empty when there is something to look for", () => {
    expect(isEmptyContainsFilterText("a")).toBe(false);
    expect(isEmptyContainsFilterText("*a*")).toBe(false);
    expect(isEmptyContainsFilterText("#")).toBe(false);
  });
});

describe("containsFilterCondition", () => {
  test("returns null when disabled or empty", () => {
    expect(containsFilterCondition("text", false, "Coffee")).toBeNull();
    expect(containsFilterCondition("text", true, "")).toBeNull();
    expect(containsFilterCondition("text", true, "  ")).toBeNull();
    expect(containsFilterCondition("text", true, "*")).toBeNull();
  });

  test("binds the trimmed filter text for the given column", () => {
    const condition = containsFilterCondition("t.text", true, "  Now* ");

    expect(condition).not.toBeNull();
    expect(condition!.sql).toContain("t.text");
    expect(condition!.param).toBe("Now*");
  });
});
