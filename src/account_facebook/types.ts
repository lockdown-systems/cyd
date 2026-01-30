// Facebook Job Row from SQLite database
export interface FacebookJobRow {
  id: number;
  jobType: string;
  status: string;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progressJSON: string | null;
  error: string | null;
}
