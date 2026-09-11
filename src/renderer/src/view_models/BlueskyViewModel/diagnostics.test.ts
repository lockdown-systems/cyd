import { describe, it, expect } from "vitest";
import { blueskyDiagnostic } from "./diagnostics";

describe("blueskyDiagnostic", () => {
  it("keeps the state, job, and error class", () => {
    expect(
      blueskyDiagnostic(new TypeError("boom"), {
        state: "BlueskyWizardDashboard",
        jobType: "savePosts",
      }),
    ).toEqual({
      state: "BlueskyWizardDashboard",
      jobType: "savePosts",
      errorClass: "TypeError",
    });
  });

  it("reports no job when the failure was outside one", () => {
    expect(
      blueskyDiagnostic(new Error("boom"), { state: "BlueskyWizardDashboard" })
        .jobType,
    ).toBe("");
  });

  it("drops the error message, which can quote saved content or a local path", () => {
    const diagnostic = blueskyDiagnostic(
      new Error("could not read /home/alice/.cyd/Bluesky/data.sqlite3"),
      { state: "BlueskyWizardDashboard" },
    );

    expect(JSON.stringify(diagnostic)).not.toContain("/home/alice");
    expect(Object.keys(diagnostic).sort()).toEqual([
      "errorClass",
      "jobType",
      "state",
    ]);
  });

  it("describes a thrown non-error by its type", () => {
    expect(
      blueskyDiagnostic("did:plc:examplealice", {
        state: "BlueskyWizardDashboard",
      }).errorClass,
    ).toBe("string");
  });
});
