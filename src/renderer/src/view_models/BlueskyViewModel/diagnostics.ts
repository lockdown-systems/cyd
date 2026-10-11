// Diagnostics carry operational metadata only (state, job, error class) — never content, handles, DIDs, credentials, or paths, so never include error messages.
export type BlueskyDiagnostic = {
  /** The view model state that failed. */
  state: string;
  /** The job that failed, or "" when the failure was not inside a job. */
  jobType: string;
  /** The error's class, e.g. "TypeError". */
  errorClass: string;
};

export function blueskyDiagnostic(
  error: unknown,
  context: { state: string; jobType?: string },
): BlueskyDiagnostic {
  return {
    state: context.state,
    jobType: context.jobType ?? "",
    errorClass: error instanceof Error ? error.name : typeof error,
  };
}
