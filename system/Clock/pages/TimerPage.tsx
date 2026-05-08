import React, { useEffect, useRef, useState } from 'react';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { CollapsingToolbar, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { IcMoreVert, IcPlay, IcPause, IcStop, IcSun } from '../res/icons';
import { WheelColumn } from '../components/WheelColumn';
import { pad2 } from '../utils';
import { now as timeNow } from '../../../os/TimeService';

const formatTimerValue = (seconds: number) => {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
};

export const TimerPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(20);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [keepScreen, setKeepScreen] = useState(false);
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!targetRef.current) return;
      const next = Math.max(0, Math.ceil((targetRef.current - timeNow()) / 1000));
      setRemaining(next);
      if (next <= 0) {
        setRunning(false);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [running]);

  const handleStart = () => {
    const duration = hours * 3600 + minutes * 60 + seconds;
    if (duration <= 0) return;
    setTotal(duration);
    setRemaining(duration);
    targetRef.current = timeNow() + duration * 1000;
    setRunning(true);
  };

  const handlePause = () => {
    if (!targetRef.current) return;
    const next = Math.max(0, Math.ceil((targetRef.current - timeNow()) / 1000));
    setRemaining(next);
    targetRef.current = null;
    setRunning(false);
  };

  const handleResume = () => {
    targetRef.current = timeNow() + remaining * 1000;
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
    targetRef.current = null;
    setRemaining(0);
    setTotal(0);
  };

  const presetList = [
    { label: '00:20:00', seconds: 1200 },
    { label: '00:30:00', seconds: 1800 },
    { label: '00:10:00', seconds: 600 },
    { label: '19:30:00', seconds: 70200 },
    { label: '00:05:00', seconds: 300 },
    { label: '00:15:00', seconds: 900 },
  ];

  const applyPreset = (secondsValue: number) => {
    const hh = Math.floor(secondsValue / 3600);
    const mm = Math.floor((secondsValue % 3600) / 60);
    const ss = secondsValue % 60;
    setHours(hh);
    setMinutes(mm);
    setSeconds(ss);
  };

  const progress = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="h-full w-full bg-app-bg relative flex flex-col">
      <CollapsingToolbar
        title={s.timer_tab}
        bgClass="bg-app-bg"
        rightContent={<ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />}
      />
      <div className="shrink-0" style={{ height: TOOLBAR_SPACER_HEIGHT }} aria-hidden />
      <div className="px-[26px] pb-2">
        <h1 className="text-[32px] font-normal text-app-text">{s.timer_tab}</h1>
      </div>
      <div className="px-6 flex-1 min-h-0 flex flex-col">
        {!running && remaining === 0 ? (
          <>
            <div className="flex justify-center items-center gap-2 mt-12 -mb-2">
              <WheelColumn value={hours} options={Array.from({ length: 24 }, (_, i) => i)} onChange={setHours} large wrap />
              <span className="text-[42px] font-medium text-black leading-none pb-2">:</span>
              <WheelColumn value={minutes} options={Array.from({ length: 60 }, (_, i) => i)} onChange={setMinutes} large wrap />
              <span className="text-[42px] font-medium text-black leading-none pb-2">:</span>
              <WheelColumn value={seconds} options={Array.from({ length: 60 }, (_, i) => i)} onChange={setSeconds} large wrap />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-12 mb-6">
              {presetList.map(item => (
                <button
                  key={item.label}
                  onClick={() => applyPreset(item.seconds)}
                  className={`py-2 rounded-xl border text-[20px] ${
                    hours * 3600 + minutes * 60 + seconds === item.seconds
                      ? 'bg-gray-200 border-app-border text-gray-800'
                      : 'border-app-border text-app-text-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center mt-auto pb-28">
              <button
                className="px-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary"
                onClick={handleStart}
              >
                <IcPlay size={28} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center mb-6">
              <div className="relative w-(--app-timer-ring-size) h-(--app-timer-ring-size)">
                <svg className="w-full h-full text-app-primary" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" stroke="var(--app-border)" strokeWidth="6" fill="none" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${Math.PI * 2 * 52}`}
                    strokeDashoffset={`${Math.PI * 2 * 52 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[32px] font-medium text-black">{formatTimerValue(remaining)}</div>
                  <div className="text-[12px] text-gray-400">{s.timer_total_minutes_prefix}{Math.round(total / 60)}{s.timer_total_minutes_suffix}</div>
                  <button
                    onClick={() => setKeepScreen(!keepScreen)}
                    className="mt-3 px-4 py-1 rounded-full bg-app-primary text-white text-[12px] flex items-center gap-1"
                  >
                    <IcSun size={14} />
                    {s.timer_screen_on}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-20 pb-28">
              <button onClick={handleStop} className="w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                <IcStop size={20} />
              </button>
              {running ? (
                <button onClick={handlePause} className="w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                  <IcPause size={22} />
                </button>
              ) : (
                <button onClick={handleResume} className="w-14 h-14 rounded-full bg-app-surface shadow flex items-center justify-center text-app-primary">
                  <IcPlay size={22} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
