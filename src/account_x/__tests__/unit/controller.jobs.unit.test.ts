import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createXControllerTestContext } from "../fixtures/accountTestHarness";
import { createJobs } from "../../controller/jobs/createJobs";
import { getLastFinishedJob } from "../../controller/jobs/getLastFinishedJob";
import { exec } from "../../../database";

describe("createJobs", () => {
  let harness: ReturnType<typeof createXControllerTestContext>;

  beforeEach(async () => {
    harness = createXControllerTestContext();
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  test("should create new pending jobs", () => {
    const jobTypes = ["index", "archive", "delete"];
    const jobs = createJobs(harness.controller, jobTypes);

    expect(jobs).toHaveLength(3);
    expect(jobs[0].jobType).toBe("index");
    expect(jobs[0].status).toBe("pending");
    expect(jobs[1].jobType).toBe("archive");
    expect(jobs[1].status).toBe("pending");
    expect(jobs[2].jobType).toBe("delete");
    expect(jobs[2].status).toBe("pending");

    // Verify all jobs have scheduledAt timestamp
    jobs.forEach((job) => {
      expect(job.scheduledAt).toBeInstanceOf(Date);
    });
  });

  test("should cancel existing pending jobs before creating new ones", () => {
    // Create initial pending jobs
    const initialJobs = createJobs(harness.controller, ["index", "archive"]);
    expect(initialJobs).toHaveLength(2);

    // Create new jobs - should cancel the previous pending jobs
    const newJobs = createJobs(harness.controller, ["delete"]);
    expect(newJobs).toHaveLength(1);
    expect(newJobs[0].jobType).toBe("delete");

    // Verify previous jobs were canceled
    const canceledJobs = exec(
      harness.controller.db,
      "SELECT * FROM job WHERE status = ?",
      ["canceled"],
      "all",
    );
    expect(canceledJobs).toHaveLength(2);
  });

  test("should return empty array when no job types provided", () => {
    const jobs = createJobs(harness.controller, []);
    expect(jobs).toHaveLength(0);
  });

  test("should initialize DB if not already initialized", () => {
    // Close the DB to test initialization
    harness.controller.db?.close();
    harness.controller.db = null;

    const jobs = createJobs(harness.controller, ["index"]);
    expect(jobs).toHaveLength(1);
    expect(harness.controller.db).not.toBeNull();
  });

  test("should order jobs by ID", () => {
    const jobTypes = ["delete", "archive", "index"];
    const jobs = createJobs(harness.controller, jobTypes);

    // Jobs should be ordered by ID (which reflects insertion order)
    expect(jobs[0].jobType).toBe("delete");
    expect(jobs[1].jobType).toBe("archive");
    expect(jobs[2].jobType).toBe("index");
    expect(jobs[0].id).toBeLessThan(jobs[1].id!);
    expect(jobs[1].id).toBeLessThan(jobs[2].id!);
  });
});

describe("getLastFinishedJob", () => {
  let harness: ReturnType<typeof createXControllerTestContext>;

  beforeEach(async () => {
    harness = createXControllerTestContext();
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  test("should return null when no finished jobs exist", async () => {
    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).toBeNull();
  });

  test("should return the most recent finished job", async () => {
    // Create and finish multiple jobs
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt, finishedAt) VALUES (?, ?, ?, ?)",
      ["index", "finished", new Date("2025-01-01"), new Date("2025-01-01")],
    );
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt, finishedAt) VALUES (?, ?, ?, ?)",
      ["index", "finished", new Date("2025-01-02"), new Date("2025-01-03")],
    );
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt, finishedAt) VALUES (?, ?, ?, ?)",
      ["index", "finished", new Date("2025-01-03"), new Date("2025-01-02")],
    );

    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).not.toBeNull();
    expect(job!.jobType).toBe("index");
    // Should return the one with the latest finishedAt (2025-01-03)
    expect(job!.finishedAt).toEqual(new Date("2025-01-03"));
  });

  test("should filter by job type", async () => {
    // Create finished jobs of different types
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt, finishedAt) VALUES (?, ?, ?, ?)",
      ["index", "finished", new Date("2025-01-01"), new Date("2025-01-01")],
    );
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt, finishedAt) VALUES (?, ?, ?, ?)",
      ["archive", "finished", new Date("2025-01-02"), new Date("2025-01-02")],
    );

    const indexJob = await getLastFinishedJob(harness.controller, "index");
    expect(indexJob).not.toBeNull();
    expect(indexJob!.jobType).toBe("index");

    const archiveJob = await getLastFinishedJob(harness.controller, "archive");
    expect(archiveJob).not.toBeNull();
    expect(archiveJob!.jobType).toBe("archive");
  });

  test("should ignore non-finished jobs", async () => {
    // Create pending and canceled jobs
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)",
      ["index", "pending", new Date()],
    );
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)",
      ["index", "canceled", new Date()],
    );

    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).toBeNull();
  });

  test("should return null when account has no username", async () => {
    harness.controller.account!.username = "";
    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).toBeNull();
  });

  test("should return null when account is null", async () => {
    harness.controller.account = null;
    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).toBeNull();
  });

  test("should initialize DB if not already initialized", async () => {
    // Close the DB to test initialization
    harness.controller.db?.close();
    harness.controller.db = null;

    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).toBeNull();
    expect(harness.controller.db).not.toBeNull();
  });

  test("should require finishedAt to be non-null", async () => {
    // Create a finished job with null finishedAt (shouldn't happen in practice)
    exec(
      harness.controller.db,
      "INSERT INTO job (jobType, status, scheduledAt, finishedAt) VALUES (?, ?, ?, ?)",
      ["index", "finished", new Date(), null],
    );

    const job = await getLastFinishedJob(harness.controller, "index");
    expect(job).toBeNull();
  });
});
