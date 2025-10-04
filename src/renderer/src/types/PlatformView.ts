export interface BasePlatformViewModel {
  state: string;
  runJobsState: string;
  progress: unknown; // Will be typed per platform
  jobs: unknown[]; // Will be typed per platform
  isPaused: boolean;
  showBrowser: boolean;
  showAutomationNotice: boolean;
  instructions: string;
  pause: () => void;
  resume: () => void;
  reloadAccount: () => Promise<void>;
}
