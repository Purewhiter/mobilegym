import { createContext, useContext } from 'react';
import type { AppId } from './types';

interface ActivityContextValue {
  activityId: string;
  appId: AppId;
  taskId: string;
}

export const ActivityContext = createContext<ActivityContextValue>({
  activityId: '',
  appId: '',
  taskId: '',
});

export const useActivityId = () => useContext(ActivityContext).activityId;

export const useActivityContext = () => useContext(ActivityContext);
