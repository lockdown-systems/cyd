/**
 * Automatic Bluesky diagnostics carry operational metadata only: the state or
 * job that failed and the class of error. They never carry record or chat
 * content, media, handles, DIDs, credentials, or local paths, which rules out
 * error messages because a message can quote any of those.
 *
 * See docs/adr/0029-minimize-bluesky-diagnostics.md.
 */
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
