export interface BroadcastIntent {
  action: string;
  data?: Record<string, any>;
  extras?: Record<string, any>;
}

export type BroadcastReceiver = (intent: BroadcastIntent) => void;

export interface BroadcastRegistration {
  action: string;
  receiver: BroadcastReceiver;
  priority?: number;
}
