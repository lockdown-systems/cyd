export enum UpdateStatus {
  Unknown,
  Error,
  Checking,
  Available,
  NotAvailable,
  Downloaded,
}

export type DeviceInfo = {
  userEmail: string;
  deviceDescription: string;
  deviceToken: string;
  deviceUUID: string;
  apiToken: string;
  valid: boolean;
};

export type ButtonInfo = {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  hide?: boolean;
  dangerStyle?: boolean;
};
