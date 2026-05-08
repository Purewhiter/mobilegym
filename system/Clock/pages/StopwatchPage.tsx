import React, { useEffect, useRef, useState } from 'react';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { CollapsingToolbar, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { IcMoreVert, IcFlag, IcPlay, IcPause, IcStop } from '../res/icons';
import { pad2 } from '../utils';
import { now as timeNow } from '../../../os/TimeService';

const formatStopwatchTime = (ms: number) => {
  const totalCentis = Math.floor(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${pad2(minutes)}:${pad2(seconds)}.${pad2(centis)}`;
};

interface StopwatchDisplayProps {
  running: boolean;
  baseElapsed: number;
  startTime: number | null;
  hasLaps: boolean;
}

const StopwatchDisplay: React.FC<StopwatchDisplayProps> = ({ running, baseElapsed, startTime, hasLaps }) => {
  const [elapsed, setElapsed] = useState(baseElapsed);

  useEffect(() => {
    if (!running || startTime === null) {
      setElapsed(baseElapsed);
      return;
    }
    const timer = setInterval(() => {
      setElapsed(baseElapsed + (timeNow() - startTime));
    }, 30);
    return () => clearInterval(timer);
  }, [running, baseElapsed, startTime]);

  return (
    <div className={`font-medium text-black tabular-nums ${hasLaps ? 'text-[40px]' : 'text-[64px]'}`}>
      {formatStopwatchTime(elapsed)}
    </div>
  );
};

export const StopwatchPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<{ id: number; lap: number; total: number }[]>([]);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  const handleStart = () => {
    startRef.current = timeNow();
    setRunning(true);
  };

  const handlePause = () => {
    if (startRef.current !== null) {
      baseRef.current = baseRef.current + (timeNow() - startRef.current);
      startRef.current = null;
    }
    setRunning(false);
  };

  const handleReset = () => {
    startRef.current = null;
    baseRef.current = 0;
    setLaps([]);
    setRunning(false);
  };

  const handleLap = () => {
    const total = running && startRef.current !== null
      ? baseRef.current + (timeNow() - startRef.current)
      : baseRef.current;
    const lastTotal = laps[0]?.total ?? 0;
    const lap = total - lastTotal;
    setLaps([{ id: laps.length + 1, lap, total }, ...laps]);
  };

  return (
    <div className="h-full w-full bg-app-bg relative flex flex-col">
      <CollapsingToolbar
        title={s.stopwatch_tab}
        bgClass="bg-app-bg"
        rightContent={<ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />}
      />
      <div className="shrink-0" style={{ height: TOOLBAR_SPACER_HEIGHT }} aria-hidden />
      <div className="px-[26px] pb-2">
        <h1 className="text-[32px] font-normal text-app-text">{s.stopwatch_tab}</h1>
      </div>
      <div className="px-6 flex-1 min-h-0 flex flex-col">
        <div className={laps.length > 0 ? 'flex items-center justify-center py-4' : 'flex-1 flex items-center justify-center'}>
          <StopwatchDisplay
            running={running}
            baseElapsed={baseRef.current}
            startTime={startRef.current}
            hasLaps={laps.length > 0}
          />
        </div>
        {laps.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {laps.map(item => (
              <div key={item.id} className="h-(--app-stopwatch-lap-height) flex items-center justify-between text-[20px] text-app-text-muted px-1 border-b border-gray-100">
                <span>{pad2(item.id)}</span>
                <span>+ {formatStopwatchTime(item.lap)}</span>
                <span className="text-black font-medium">{formatStopwatchTime(item.total)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-center gap-20 mt-auto pb-28">
          {running ? (
            <>
              <button onClick={handleLap} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcFlag size={22} />
              </button>
              <button onClick={handlePause} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcPause size={22} />
              </button>
            </>
          ) : baseRef.current === 0 ? (
            <button onClick={handleStart} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
              <IcPlay size={28} />
            </button>
          ) : (
            <>
              <button onClick={handleReset} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcStop size={20} />
              </button>
              <button onClick={handleStart} className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcPlay size={28} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
