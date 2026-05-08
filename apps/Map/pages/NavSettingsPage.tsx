import React from 'react';
import { IcClose } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStore } from '../state';
import { useMapStrings } from '../hooks/useMapStrings';

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-300 overflow-hidden h-12">
      {options.map((opt, i) => (
        <React.Fragment key={opt.value}>
          {i > 0 && <div className="w-px bg-gray-300 shrink-0" />}
          <button
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-[15px] font-medium ${
              value === opt.value ? 'bg-[#C2E7FF] text-[#001D35]' : 'bg-app-surface text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function ToggleRow({
  title,
  subtitle,
  checked,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="py-5 flex justify-between items-center -mx-6 px-6 active:bg-gray-50 cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex-1 pr-4">
        <div className="text-[17px] font-bold text-gray-900">{title}</div>
        {subtitle && <div className="text-[15px] text-app-text-muted mt-1">{subtitle}</div>}
      </div>
      <button
        type="button"
        className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
          checked ? 'bg-app-primary-dark' : 'bg-gray-200'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
            checked ? 'left-5' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

function StaticRow({ title, value }: { title: string; value?: string }) {
  return (
    <div className="py-5 flex justify-between items-center -mx-6 px-6">
      <div className="text-[17px] font-bold text-gray-900">{title}</div>
      {value ? <div className="text-[15px] text-app-text-muted">{value}</div> : null}
    </div>
  );
}

export const NavSettingsPage: React.FC = () => {
  const { bindBack } = useMapGestures();
  const navPrefs = useMapStore((s) => s.settings.navigation);
  const updateNavPrefs = useMapStore((s) => s.updateNavPrefs);
  const s = useMapStrings();

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex justify-between items-center px-4 pt-12 pb-4 bg-app-surface border-b border-gray-100 shadow-sm z-10">
        <div className="text-[28px] font-bold text-gray-900">{s.nav_title}</div>
        <button
          type="button"
          {...bindBack()}
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
        >
          <IcClose size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-8">
        <div className="text-[20px] font-bold mb-4 mt-4">{s.nav_sound_voice}</div>

        <div className="mb-4">
          <div className="text-[15px] font-medium text-gray-900 mb-2">{s.nav_mute_status}</div>
          <SegmentControl
            options={[
              { value: 'muted', label: s.nav_muted },
              { value: 'alerts', label: s.nav_alerts_only },
              { value: 'unmuted', label: s.nav_unmuted },
            ]}
            value={navPrefs.muteState}
            onChange={(v) => updateNavPrefs('muteState', v)}
          />
        </div>

        <div className="mb-4">
          <div className="text-[15px] font-medium text-gray-900 mb-2">{s.nav_voice_volume}</div>
          <SegmentControl
            options={[
              { value: 'low', label: s.nav_volume_low },
              { value: 'medium', label: s.nav_volume_medium },
              { value: 'high', label: s.nav_volume_high },
            ]}
            value={navPrefs.voiceVolume}
            onChange={(v) => updateNavPrefs('voiceVolume', v)}
          />
        </div>

        <StaticRow title={s.nav_voice_selection} value={s.nav_voice_default} />

        <ToggleRow
          title={s.nav_bluetooth_voice}
          checked={navPrefs.playVoiceOverBluetooth}
          onToggle={() => updateNavPrefs('playVoiceOverBluetooth', !navPrefs.playVoiceOverBluetooth)}
        />
        <ToggleRow
          title={s.nav_voice_during_calls}
          checked={navPrefs.playVoiceDuringCalls}
          onToggle={() => updateNavPrefs('playVoiceDuringCalls', !navPrefs.playVoiceDuringCalls)}
        />
        <ToggleRow
          title={s.nav_play_audio_cues}
          checked={navPrefs.playAudioCues}
          onToggle={() => updateNavPrefs('playAudioCues', !navPrefs.playAudioCues)}
        />

        <StaticRow title={s.nav_play_test_sound} />

        <ToggleRow
          title={s.nav_show_media_controls}
          checked={navPrefs.showMediaControls}
          onToggle={() => updateNavPrefs('showMediaControls', !navPrefs.showMediaControls)}
        />

        <StaticRow title={s.nav_default_media_app} />

        <div className="h-px bg-transparent mb-8" />
        <div className="text-[20px] font-bold mb-4 mt-4">{s.nav_alert_options}</div>
        <ToggleRow
          title={s.nav_alert_incident_desc}
          checked={navPrefs.trafficAlerts}
          onToggle={() => updateNavPrefs('trafficAlerts', !navPrefs.trafficAlerts)}
        />

        <div className="text-[20px] font-bold mb-4 mt-4">{s.nav_route_options}</div>
        <ToggleRow
          title={s.route_avoid_tolls}
          checked={navPrefs.avoidTolls}
          onToggle={() => updateNavPrefs('avoidTolls', !navPrefs.avoidTolls)}
        />
        <ToggleRow
          title={s.route_avoid_highways}
          checked={navPrefs.avoidHighways}
          onToggle={() => updateNavPrefs('avoidHighways', !navPrefs.avoidHighways)}
        />
        <ToggleRow
          title={s.route_avoid_ferries}
          checked={navPrefs.avoidFerries}
          onToggle={() => updateNavPrefs('avoidFerries', !navPrefs.avoidFerries)}
        />
        <ToggleRow
          title={s.nav_prefer_fuel_efficient}
          subtitle={s.nav_fuel_efficient_desc}
          checked={navPrefs.fuelEfficient}
          onToggle={() => updateNavPrefs('fuelEfficient', !navPrefs.fuelEfficient)}
        />
        <StaticRow title={s.nav_engine_type} value={s.nav_engine_gasoline} />

        <div className="text-[20px] font-bold mb-4 mt-4">{s.nav_map_display}</div>
        <div className="mb-4">
          <div className="text-[15px] font-medium text-gray-900 mb-2">{s.nav_color_scheme}</div>
          <SegmentControl
            options={[
              { value: 'auto', label: s.nav_color_auto },
              { value: 'day', label: s.nav_color_day },
              { value: 'night', label: s.nav_color_night },
            ]}
            value={navPrefs.colorScheme}
            onChange={(v) => updateNavPrefs('colorScheme', v)}
          />
        </div>
        <div className="mb-4">
          <div className="text-[15px] font-medium text-gray-900 mb-2">{s.nav_distance_units}</div>
          <SegmentControl
            options={[
              { value: 'auto', label: s.distance_unit_auto },
              { value: 'km', label: s.distance_unit_km },
              { value: 'miles', label: s.distance_unit_miles },
            ]}
            value={navPrefs.distanceUnits}
            onChange={(v) => updateNavPrefs('distanceUnits', v)}
          />
        </div>
        <ToggleRow
          title={s.nav_keep_north_up}
          checked={navPrefs.keepMapNorthUp}
          onToggle={() => updateNavPrefs('keepMapNorthUp', !navPrefs.keepMapNorthUp)}
        />

        <div className="h-px bg-gray-200 my-6 -mx-6" />
        <div className="text-[20px] font-bold mb-4">{s.nav_route_preview}</div>
        <div className="text-[15px] text-app-text-muted mb-2">{s.nav_route_preview_desc}</div>
        <ToggleRow
          title={s.nav_route_preview}
          checked={navPrefs.showRoutePreview}
          onToggle={() => updateNavPrefs('showRoutePreview', !navPrefs.showRoutePreview)}
        />
        <button type="button" className="text-[15px] text-app-primary font-medium -mx-6 px-6">
          {s.nav_learn_more}
        </button>

        <div className="h-px bg-gray-200 my-6 -mx-6" />
        <div className="text-[20px] font-bold mb-4">{s.nav_driving_options}</div>
        <ToggleRow
          title={s.nav_speedometer}
          checked={navPrefs.speedometer}
          onToggle={() => updateNavPrefs('speedometer', !navPrefs.speedometer)}
        />
        <ToggleRow
          title={s.nav_driving_notifications}
          subtitle={s.nav_driving_notifications_desc}
          checked={navPrefs.drivingNotifications}
          onToggle={() =>
            updateNavPrefs('drivingNotifications', !navPrefs.drivingNotifications)
          }
        />
        <ToggleRow
          title={s.nav_bluetooth_tunnel}
          subtitle={s.nav_bluetooth_tunnel_desc}
          checked={navPrefs.bluetoothTunnelBeacon}
          onToggle={() =>
            updateNavPrefs('bluetoothTunnelBeacon', !navPrefs.bluetoothTunnelBeacon)
          }
        />
      </div>
    </div>
  );
};

export default NavSettingsPage;
