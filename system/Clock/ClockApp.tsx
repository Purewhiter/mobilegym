import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MemoryRouter, Navigate, Route, Routes, UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { applySkinToThemeColors } from '../../os/SkinService';
import { getDate, now as timeNow } from '../../os/TimeService';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useAppStrings } from '../../os/useAppStrings';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { useClockGestures } from './hooks/useClockGestures';
import { manifest } from './manifest';
import { colorStates, colorStatesDark } from './res/colors.states';
import { colors, colorsDark } from './res/colors';
import { dimens } from './res/dimens';
import { IcDelete } from './res/icons';
import { stringsEn } from './res/strings.en';
import { strings } from './res/strings';
import { selectSelectedCities, useClockStore } from './state';
import type { Alarm, WorldCity } from './types';
import { anim } from './res/anim';
import { TabBar, type TabKey } from './components/TabBar';
import { AlarmEditModal } from './pages/AlarmEditModal';
import { AlarmEditorSheet } from './pages/AlarmEditorSheet';
import { AlarmPage } from './pages/AlarmPage';
import { CitySelectorPage } from './pages/CitySelectorPage';
import { RepeatSelectorSheet } from './pages/RepeatSelectorSheet';
import { StopwatchPage } from './pages/StopwatchPage';
import { TimerPage } from './pages/TimerPage';
import { WorldClockPage } from './pages/WorldClockPage';
import { CLOCK_CONFIG } from './data';
import { base36, nextStream } from '../../os/RandomService';
import { routes } from './routes';

const ClockShell: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { nav, back, bindNav, bindBack, bindTap } = useClockGestures();
  const location = useLocation();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  const alarms = useClockStore(st => st.alarms);
  const selectedCityIds = useClockStore(st => st.selectedCityIds);
  const selectedCities = useClockStore(selectSelectedCities);
  const toggleAlarm = useClockStore(st => st.toggleAlarm);
  const saveAlarm = useClockStore(st => st.saveAlarm);
  const storeDeleteAlarms = useClockStore(st => st.deleteAlarms);
  const addCity = useClockStore(st => st.addCity);
  const removeCities = useClockStore(st => st.removeCities);

  // Sheets live in the URL (?sheet=edit|editor|repeat on /alarm, ?sheet=city on /world): back closes them.
  const sheetParams = new URLSearchParams(location.search);
  const sheet = sheetParams.get('sheet');
  // The quick editor names its alarm in the URL (?sheet=edit&alarmId=), so it opens on the right one however reached.
  const quickEditAlarm = sheet === 'edit' ? alarms.find(a => a.id === sheetParams.get('alarmId')) : undefined;
  const showAlarmEditor = sheet === 'editor' || sheet === 'repeat';
  const showRepeat = sheet === 'repeat';
  const showCitySelector = sheet === 'city';
  // Select mode lives in the URL too (?mode=select on /alarm or /world): back and the close button leave it.
  const selectionMode = location.pathname === '/alarm' && sheetParams.get('mode') === 'select';
  const worldClockSelectionMode = location.pathname === '/world' && sheetParams.get('mode') === 'select';
  const [alarmEditorIsEditMode, setAlarmEditorIsEditMode] = useState(false);
  const [showCityExistsToast, setShowCityExistsToast] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [worldClockSelectedIds, setWorldClockSelectedIds] = useState<string[]>([]);
  const [editingAlarm, setEditingAlarm] = useState<Alarm>(() => ({
    id: `a-${timeNow()}-${base36(nextStream('clock.alarm'), 4)}`,
    hour: 7,
    minute: 0,
    enabled: true,
    repeat: 'once',
    vibrate: true,
    autoDelete: false,
  }));

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const worldClockSelectedIdSet = useMemo(() => new Set(worldClockSelectedIds), [worldClockSelectedIds]);

  useEffect(() => {
    if (!showCityExistsToast) return;
    const t = setTimeout(() => setShowCityExistsToast(false), 2000);
    return () => clearTimeout(t);
  }, [showCityExistsToast]);

  // Leaving select mode drops the selection.
  useEffect(() => {
    if (!selectionMode) setSelectedIds([]);
  }, [selectionMode]);

  useEffect(() => {
    if (!worldClockSelectionMode) setWorldClockSelectedIds([]);
  }, [worldClockSelectionMode]);

  const handleBack = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const index = typeof memoryNavigator.index === 'number' ? memoryNavigator.index : 0;
    if (index > 0) {
      back();
      return true;
    }
    return false;
  }, [back, navigator]);

  useAppNavigationHandler('clock', { onBack: handleBack });

  const prepareAddAlarm = () => {
    setEditingAlarm({
      id: `a-${timeNow()}-${base36(nextStream('clock.alarm'), 4)}`,
      hour: getDate().getHours(),
      minute: getDate().getMinutes(),
      enabled: true,
      repeat: 'once',
      vibrate: true,
      autoDelete: false,
    });
    setAlarmEditorIsEditMode(false);
  };

  const handleSaveAlarm = (alarm: Alarm) => {
    saveAlarm(alarm);
    back();
  };

  const handleToggleAlarm = (id: string) => {
    toggleAlarm(id);
  };

  const handleSelectionStart = (id: string) => {
    setSelectedIds([id]);
    nav.push(routes.alarm, {}, { search: { mode: 'select' } });
  };

  const handleSelectionToggle = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = () => {
    if (selectedIdSet.size === alarms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(alarms.map(a => a.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    storeDeleteAlarms(selectedIdSet);
    back();
  };

  const handleWorldClockSelectionStart = (id: string) => {
    setWorldClockSelectedIds([id]);
    nav.push(routes.world, {}, { search: { mode: 'select' } });
  };

  const handleWorldClockSelectionToggle = (id: string) => {
    setWorldClockSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleWorldClockToggleSelectAll = () => {
    if (worldClockSelectedIdSet.size === selectedCities.length) {
      setWorldClockSelectedIds([]);
    } else {
      setWorldClockSelectedIds(selectedCities.map(c => c.id));
    }
  };

  const handleWorldClockDeleteSelected = () => {
    if (worldClockSelectedIds.length === 0) return;
    removeCities(worldClockSelectedIdSet);
    back();
  };

  const handleSelectCity = (city: WorldCity) => {
    if (selectedCityIds.includes(city.id)) return;
    addCity(city.id);
    back();
  };

  const activeTab = location.pathname.replace('/', '') as TabKey;

  return (
    <div className="h-full w-full relative">
      <Routes>
        <Route path="/" element={<Navigate to="/alarm" replace />} />
        <Route path="/*" element={null} />
      </Routes>
      <div className="absolute inset-0" style={{ display: activeTab === 'alarm' ? undefined : 'none' }}>
        <AlarmPage
          alarms={alarms}
          selectionMode={selectionMode}
          selectedIds={selectedIdSet}
          onToggle={handleToggleAlarm}
          addBind={bindNav(routes.alarm, { search: { sheet: 'editor' }, beforeTrigger: prepareAddAlarm })}
          editBind={(alarm) => bindNav(routes.alarm, { search: { sheet: 'edit', alarmId: alarm.id } })}
          onSelectToggle={handleSelectionToggle}
          onSelectionStart={handleSelectionStart}
          onToggleSelectAll={handleToggleSelectAll}
        />
      </div>
      <div className="absolute inset-0" style={{ display: activeTab === 'world' ? undefined : 'none' }}>
        <WorldClockPage
          selectedCities={selectedCities}
          addBind={bindNav(routes.world, { search: { sheet: 'city' } })}
          selectionMode={worldClockSelectionMode}
          selectedIds={worldClockSelectedIdSet}
          onSelectToggle={handleWorldClockSelectionToggle}
          onSelectionStart={handleWorldClockSelectionStart}
          onToggleSelectAll={handleWorldClockToggleSelectAll}
        />
      </div>
      <div className="absolute inset-0" style={{ display: activeTab === 'stopwatch' ? undefined : 'none' }}>
        <StopwatchPage />
      </div>
      <div className="absolute inset-0" style={{ display: activeTab === 'timer' ? undefined : 'none' }}>
        <TimerPage />
      </div>
      {activeTab === 'alarm' && selectionMode ? (
        <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-6 pt-2 z-30 flex items-center justify-center">
          <button
            {...bindTap({ kind: 'action', id: 'clock.alarm.deleteSelected' }, { onTrigger: handleDeleteSelected })}
            className="flex flex-col items-center justify-center gap-1 text-gray-700"
          >
            <IcDelete size={22} strokeWidth={dimens.icStrokeWidth} />
            <span className="text-[10px]">{s.toolbar_delete}</span>
          </button>
        </div>
      ) : activeTab === 'world' && worldClockSelectionMode ? (
        <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-6 pt-2 z-30 flex items-center justify-center">
          <button
            {...bindTap({ kind: 'action', id: 'clock.world.deleteSelected' }, { onTrigger: handleWorldClockDeleteSelected })}
            className="flex flex-col items-center justify-center gap-1 text-gray-700"
          >
            <IcDelete size={22} strokeWidth={dimens.icStrokeWidth} />
            <span className="text-[10px]">{s.toolbar_delete}</span>
          </button>
        </div>
      ) : (
        <TabBar
          activeTab={activeTab || 'alarm'}
          bindTab={(tab) => bindNav(routes[tab], { replace: true })}
        />
      )}

      {quickEditAlarm ? (
        <AlarmEditModal
          alarm={quickEditAlarm}
          closeBind={bindBack()}
          onSave={handleSaveAlarm}
          onMoreSettings={(hour, minute) => {
            setEditingAlarm({ ...quickEditAlarm, hour, minute });
            setAlarmEditorIsEditMode(true);
            // The full editor replaces the quick editor: back from it returns to the list.
            nav.replace(routes.alarm, {}, { search: { sheet: 'editor' } });
          }}
        />
      ) : null}

      {showAlarmEditor ? (
        <AlarmEditorSheet
          alarm={editingAlarm}
          isEdit={alarmEditorIsEditMode}
          onClose={() => back()}
          closeBind={bindBack()}
          onSave={handleSaveAlarm}
          repeatBind={bindNav(routes.alarm, { search: { sheet: 'repeat' } })}
        />
      ) : null}

      {showRepeat ? (
        <RepeatSelectorSheet
          value={editingAlarm.repeat}
          onSelect={repeat => setEditingAlarm(prev => ({ ...prev, repeat }))}
          onClose={() => back()}
          closeBind={bindBack()}
        />
      ) : null}

      {showCitySelector ? (
        <CitySelectorPage
          cities={CLOCK_CONFIG.cities}
          selectedCityIds={selectedCityIds}
          onSelect={handleSelectCity}
          onClose={() => back()}
          closeBind={bindBack()}
          onAlreadySelected={() => {
            setShowCityExistsToast(true);
          }}
        />
      ) : null}

      {showCityExistsToast ? (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center pb-32">
          <span className="text-[15px] text-gray-700 bg-gray-200 rounded-lg px-4 py-2.5 shadow-lg">
            {s.timezone_exists_toast}
          </span>
        </div>
      ) : null}
    </div>
  );
};


const ClockApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <MemoryRouter>
        <ClockShell />
      </MemoryRouter>
    </div>
  );
};

export default ClockApp;
