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

const ClockShell: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { go, back } = useClockGestures();
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

  const [showAlarmEditor, setShowAlarmEditor] = useState(false);
  const [alarmEditorIsEditMode, setAlarmEditorIsEditMode] = useState(false);
  const [showAlarmEditModal, setShowAlarmEditModal] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [showCityExistsToast, setShowCityExistsToast] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [worldClockSelectionMode, setWorldClockSelectionMode] = useState(false);
  const [worldClockSelectedIds, setWorldClockSelectedIds] = useState<string[]>([]);
  const [editingAlarm, setEditingAlarm] = useState<Alarm>(() => ({
    id: `a-${timeNow()}-${Math.random().toString(36).slice(2, 6)}`,
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

  useEffect(() => {
    if (selectionMode && alarms.length === 0) {
      setSelectionMode(false);
      setSelectedIds([]);
    }
  }, [alarms.length, selectionMode]);

  useEffect(() => {
    if (worldClockSelectionMode && selectedCities.length === 0) {
      setWorldClockSelectionMode(false);
      setWorldClockSelectedIds([]);
    }
  }, [selectedCities.length, worldClockSelectionMode]);

  const handleBack = useCallback((): boolean => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds([]);
      return true;
    }
    if (worldClockSelectionMode) {
      setWorldClockSelectionMode(false);
      setWorldClockSelectedIds([]);
      return true;
    }
    if (showRepeat) {
      setShowRepeat(false);
      return true;
    }
    if (showAlarmEditModal) {
      setShowAlarmEditModal(false);
      return true;
    }
    if (showAlarmEditor) {
      setShowAlarmEditor(false);
      return true;
    }
    if (showCitySelector) {
      setShowCitySelector(false);
      return true;
    }
    const memoryNavigator = navigator as any;
    const index = typeof memoryNavigator.index === 'number' ? memoryNavigator.index : 0;
    if (index > 0) {
      back();
      return true;
    }
    return false;
  }, [
    back,
    navigator,
    selectionMode,
    showAlarmEditModal,
    showAlarmEditor,
    showCitySelector,
    showRepeat,
    worldClockSelectionMode,
  ]);

  useAppNavigationHandler('clock', { onBack: handleBack });

  const handleOpenAddAlarm = () => {
    setEditingAlarm({
      id: `a-${timeNow()}-${Math.random().toString(36).slice(2, 6)}`,
      hour: getDate().getHours(),
      minute: getDate().getMinutes(),
      enabled: true,
      repeat: 'once',
      vibrate: true,
      autoDelete: false,
    });
    setAlarmEditorIsEditMode(false);
    setShowAlarmEditor(true);
  };

  const handleOpenEditAlarm = (alarm: Alarm) => {
    setEditingAlarm(alarm);
    setShowAlarmEditModal(true);
  };

  const handleSaveAlarm = (alarm: Alarm) => {
    saveAlarm(alarm);
    setShowAlarmEditor(false);
    setShowAlarmEditModal(false);
  };

  const handleToggleAlarm = (id: string) => {
    toggleAlarm(id);
  };

  const handleSelectionStart = (id: string) => {
    setSelectionMode(true);
    setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleSelectionToggle = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleExitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
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
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleWorldClockSelectionStart = (id: string) => {
    setWorldClockSelectionMode(true);
    setWorldClockSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleWorldClockSelectionToggle = (id: string) => {
    setWorldClockSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleWorldClockExitSelection = () => {
    setWorldClockSelectionMode(false);
    setWorldClockSelectedIds([]);
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
    setWorldClockSelectionMode(false);
    setWorldClockSelectedIds([]);
  };

  const handleSelectCity = (city: WorldCity) => {
    if (selectedCityIds.includes(city.id)) return;
    addCity(city.id);
    setShowCitySelector(false);
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
          onOpenAdd={handleOpenAddAlarm}
          onEdit={handleOpenEditAlarm}
          onSelectToggle={handleSelectionToggle}
          onSelectionStart={handleSelectionStart}
          onExitSelection={handleExitSelection}
          onToggleSelectAll={handleToggleSelectAll}
          onDeleteSelected={handleDeleteSelected}
        />
      </div>
      <div className="absolute inset-0" style={{ display: activeTab === 'world' ? undefined : 'none' }}>
        <WorldClockPage
          selectedCities={selectedCities}
          onOpenAdd={() => setShowCitySelector(true)}
          selectionMode={worldClockSelectionMode}
          selectedIds={worldClockSelectedIdSet}
          onSelectToggle={handleWorldClockSelectionToggle}
          onSelectionStart={handleWorldClockSelectionStart}
          onExitSelection={handleWorldClockExitSelection}
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
            onClick={handleDeleteSelected}
            className="flex flex-col items-center justify-center gap-1 text-gray-700"
          >
            <IcDelete size={22} strokeWidth={dimens.icStrokeWidth} />
            <span className="text-[10px]">{s.toolbar_delete}</span>
          </button>
        </div>
      ) : activeTab === 'world' && worldClockSelectionMode ? (
        <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-6 pt-2 z-30 flex items-center justify-center">
          <button
            onClick={handleWorldClockDeleteSelected}
            className="flex flex-col items-center justify-center gap-1 text-gray-700"
          >
            <IcDelete size={22} strokeWidth={dimens.icStrokeWidth} />
            <span className="text-[10px]">{s.toolbar_delete}</span>
          </button>
        </div>
      ) : (
        <TabBar
          activeTab={activeTab || 'alarm'}
          onChange={(tab) => {
            if (tab === 'alarm') go('tab.alarm');
            else if (tab === 'world') go('tab.world');
            else if (tab === 'stopwatch') go('tab.stopwatch');
            else if (tab === 'timer') go('tab.timer');
          }}
        />
      )}

      {showAlarmEditModal ? (
        <AlarmEditModal
          alarm={editingAlarm}
          onClose={() => setShowAlarmEditModal(false)}
          onSave={handleSaveAlarm}
          onMoreSettings={(hour, minute) => {
            setEditingAlarm(prev => ({ ...prev, hour, minute }));
            setShowAlarmEditModal(false);
            setAlarmEditorIsEditMode(true);
            setShowAlarmEditor(true);
          }}
        />
      ) : null}

      {showAlarmEditor ? (
        <AlarmEditorSheet
          alarm={editingAlarm}
          isEdit={alarmEditorIsEditMode}
          onClose={() => setShowAlarmEditor(false)}
          onSave={handleSaveAlarm}
          onOpenRepeat={() => setShowRepeat(true)}
        />
      ) : null}

      {showRepeat ? (
        <RepeatSelectorSheet
          value={editingAlarm.repeat}
          onSelect={repeat => setEditingAlarm(prev => ({ ...prev, repeat }))}
          onClose={() => setShowRepeat(false)}
        />
      ) : null}

      {showCitySelector ? (
        <CitySelectorPage
          cities={CLOCK_CONFIG.cities}
          selectedCityIds={selectedCityIds}
          onSelect={handleSelectCity}
          onClose={() => setShowCitySelector(false)}
          onAlreadySelected={() => {
            setShowCitySelector(false);
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
