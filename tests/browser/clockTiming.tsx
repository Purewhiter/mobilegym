import React from 'react';
import { createRoot } from 'react-dom/client';
import * as TimeService from '../../os/TimeService';
import { useClockDate } from '../../os/useSystemTime';
declare global {
  interface Window { __clockTimingReview: { TimeService: typeof TimeService }; }
}
TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
TimeService.setSpeed(10);
window.__clockTimingReview = { TimeService };
function Clock() { const date = useClockDate(); return <div id="clock">{date.getHours()}:{String(date.getMinutes()).padStart(2,'0')}</div>; }
createRoot(document.getElementById('root')!).render(<Clock/>);
