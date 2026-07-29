# Run save and delete as durable resumable jobs

Desktop Bluesky save and delete operations are durable, resumable, and idempotent. They commit progress incrementally, expose rate-limit backoff, and recover after restart without silently duplicating work; destructive jobs require explicit review and confirmation before their first execution, while safe retries of that confirmed job do not require per-item confirmation.
