import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStrings } from '@/os/useAppStrings';
import {
  IcArrowBack, IcNavForward, IcExpand, IcUser, IcShield, IcGlobe,
  IcType, IcImage, IcArrowDown, IcComment, IcHelp, IcFile,
  IcMail, IcAlertTriangle, IcMoon, IcSun, IcPalette, IcExternalLink,
  IcSettings, IcEye,
} from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

/* ──────────── switch ──────────── */
interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  actionProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, actionProps }) => {
  const { onClick: actionOnClick, ...rest } = actionProps ?? {};
  return (
    <div
      className={`w-[51px] h-[31px] rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${
        checked ? 'bg-[#0079D3]' : 'bg-[#d7dadc]'
      }`}
      {...rest}
      onClick={(e) => {
        if (actionOnClick) return actionOnClick(e);
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <div
        className={`w-[27px] h-[27px] bg-app-surface rounded-full absolute top-[2px] transition-all shadow-sm ${
          checked ? 'left-[22px]' : 'left-[2px]'
        }`}
      />
    </div>
  );
};

/* ──────────── section header ──────────── */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 py-3 bg-[#EDEFF1]">
    <span className="text-[13px] font-bold text-app-text-muted uppercase tracking-wide">{title}</span>
  </div>
);

/* ──────────── list item ──────────── */
interface ListItemProps {
  label: string;
  subtitle?: string;
  Icon?: React.ElementType;
  iconNode?: React.ReactNode;
  iconColor?: string;
  hasArrow?: boolean;
  hasSwitch?: boolean;
  checked?: boolean;
  onSwitchChange?: (v: boolean) => void;
  switchActionProps?: React.HTMLAttributes<HTMLDivElement>;
  rightText?: string;
  hasDropdown?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  [key: string]: any;
}

const ListItem: React.FC<ListItemProps> = ({
  label,
  subtitle,
  Icon,
  iconNode,
  iconColor = 'text-app-text-muted',
  hasArrow = false,
  hasSwitch = false,
  checked = false,
  onSwitchChange,
  switchActionProps,
  rightText,
  hasDropdown = false,
  disabled = false,
  onClick,
  ...rest
}) => (
  <div
    className={`flex items-center justify-between px-4 py-4 bg-app-surface border-b border-app-border ${
      disabled ? 'opacity-40' : 'active:bg-gray-50'
    }`}
    onClick={disabled ? undefined : onClick}
    {...rest}
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {Icon && <Icon className={`w-6 h-6 ${iconColor} flex-shrink-0`} strokeWidth={2} />}
      {iconNode && <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">{iconNode}</div>}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-[16px] ${disabled ? 'text-[#C8C8C8]' : 'text-app-text'}`}>
          {label}
        </span>
        {subtitle && (
          <span className="text-[13px] text-app-text-muted leading-tight">{subtitle}</span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
      {rightText && (
        <span className="text-[14px] text-app-text-muted mr-1">{rightText}</span>
      )}
      {hasSwitch && onSwitchChange && (
        <Switch checked={checked} onChange={onSwitchChange} actionProps={switchActionProps} />
      )}
      {hasArrow && <IcNavForward className="w-5 h-5 text-[#c8c8c8]" strokeWidth={2} />}
      {hasDropdown && <IcExpand className="w-5 h-5 text-[#c8c8c8]" strokeWidth={2} />}
    </div>
  </div>
);

/* ──────────── main settings page ──────────── */
export const SettingsPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap, back } = useRedditGestures();
  const { settings, user } = useRedditStore(useShallow((st) => ({ settings: st.settings, user: st.user })));
  const updateSettings = useRedditStore((st) => st.updateSettings);
  const [searchParams, setSearchParams] = useSearchParams();
  const openLinksSheetOpen = searchParams.get('sheet') === 'openLinks';
  const openLinksLabel = settings.openLinksInApp ? s.settings_in_app : s.settings_default_browser;

  return (
    <div className="flex flex-col h-full bg-[#EDEFF1]">
      {/* ──── Top bar ──── */}
      <div className="flex items-center gap-4 px-4 pt-10 pb-4 bg-app-surface border-b border-app-border">
        <button
          type="button"
          aria-label="Back"
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100"
          {...bindBack()}
        >
          <IcArrowBack className="w-7 h-7 text-app-text" strokeWidth={2} />
        </button>
        <span className="text-[22px] font-bold text-app-text">{s.settings_title}</span>
      </div>

      {/* ──── Scrollable content ──── */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* ═══ General ═══ */}
        <SectionHeader title={s.settings_section_general} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_account_for.replace('{username}', user.username)}
            Icon={IcUser}
            hasArrow
          />
        </div>

        {/* ═══ Reddit Premium ═══ */}
        <SectionHeader title={s.settings_section_premium} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_get_premium}
            Icon={IcShield}
            iconColor="text-[#FF4500]"
            hasArrow
          />
        </div>

        {/* ═══ Language ═══ */}
        <SectionHeader title={s.settings_section_language} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_language}
            Icon={IcGlobe}
            rightText={s.settings_device_language}
            hasDropdown
          />
          <ListItem
            label={s.settings_content_languages}
            Icon={IcGlobe}
            hasArrow
          />
        </div>

        {/* ═══ View Options ═══ */}
        <SectionHeader title={s.settings_section_view} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_default_view}
            Icon={IcSettings}
            rightText={s.settings_card}
            hasDropdown
          />
          <ListItem
            label={s.settings_thumbnails}
            Icon={IcImage}
            rightText={s.settings_community_default}
            hasDropdown
          />
          <ListItem
            label={s.settings_show_nsfw}
            Icon={IcEye}
            hasSwitch
            checked={settings.showNSFW}
            onSwitchChange={(v) => updateSettings({ showNSFW: v })}
            switchActionProps={bindTap(
              { kind: 'action', id: 'settings.showNSFW.toggle' } as any,
              {
                stopPropagation: true,
                onTrigger: () => updateSettings({ showNSFW: !settings.showNSFW }),
              },
            )}
          />
          <ListItem
            label={s.settings_blur_nsfw}
            iconNode={
              <div className="w-6 h-6 rounded-full border-2 border-app-text-muted flex items-center justify-center">
                <span className="text-[10px] font-bold text-app-text-muted">18</span>
              </div>
            }
            hasSwitch
            checked={settings.blurNSFW}
            onSwitchChange={(v) => updateSettings({ blurNSFW: v })}
            disabled={!settings.showNSFW}
            switchActionProps={bindTap(
              { kind: 'action', id: 'settings.blurNSFW.toggle' } as any,
              {
                stopPropagation: true,
                onTrigger: () => updateSettings({ blurNSFW: !settings.blurNSFW }),
              },
            )}
          />
          <ListItem
            label={s.settings_community_themes}
            Icon={IcPalette}
            hasSwitch
            checked={settings.showCommunityStyles}
            onSwitchChange={(v) => updateSettings({ showCommunityStyles: v })}
            switchActionProps={bindTap(
              { kind: 'action', id: 'settings.showCommunityStyles.toggle' } as any,
              {
                stopPropagation: true,
                onTrigger: () => updateSettings({ showCommunityStyles: !settings.showCommunityStyles }),
              },
            )}
          />
        </div>

        {/* ═══ Data Usage ═══ */}
        <SectionHeader title={s.settings_section_data} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_low_data}
            Icon={IcAlertTriangle}
            hasArrow
          />
        </div>

        {/* ═══ Accessibility ═══ */}
        <SectionHeader title={s.settings_section_accessibility} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_text_size}
            Icon={IcType}
            hasArrow
            {...bindTap(
              { kind: 'action', id: 'settings.textSize.select' } as any,
              { onTrigger: () => {} },
            )}
          />
          <ListItem
            label={s.settings_media_animations}
            iconNode={
              <div className="w-5 h-5 rounded border-2 border-app-text-muted relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-current border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent text-app-text-muted" />
              </div>
            }
            hasArrow
          />
          <ListItem
            label={s.settings_talkback}
            Icon={IcUser}
            hasArrow
          />
        </div>

        {/* ═══ Dark Mode ═══ */}
        <SectionHeader title={s.settings_section_dark_mode} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_auto_dark}
            Icon={IcSun}
            rightText={s.settings_follow_os}
            hasDropdown
          />
          <ListItem
            label={s.settings_dark_mode_label}
            Icon={IcMoon}
            hasSwitch
            checked={settings.theme === 'dark'}
            onSwitchChange={(v) => updateSettings({ theme: v ? 'dark' : 'light' })}
            disabled={settings.theme === 'auto'}
            switchActionProps={bindTap(
              { kind: 'action', id: 'settings.theme.select.dark' } as any,
              {
                stopPropagation: true,
                onTrigger: () => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
              },
            )}
          />
          <ListItem
            label={s.settings_light_theme}
            Icon={IcSun}
            rightText="Alien Blue"
            hasDropdown
          />
          <ListItem
            label={s.settings_dark_theme}
            Icon={IcMoon}
            rightText="Night"
            hasDropdown
          />
        </div>

        {/* ═══ Advanced ═══ */}
        <SectionHeader title={s.settings_section_advanced} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_open_links}
            Icon={IcExternalLink}
            rightText={openLinksLabel}
            hasDropdown
            onClick={() => setSearchParams(p => { p.set('sheet', 'openLinks'); return p; })}
          />
          <ListItem
            label={s.settings_saved_image_attribution}
            Icon={IcImage}
            hasSwitch
            checked={settings.savedImageAttribution}
            onSwitchChange={(v) => updateSettings({ savedImageAttribution: v })}
            switchActionProps={bindTap(
              { kind: 'action', id: 'settings.savedImageAttribution.toggle' } as any,
              {
                stopPropagation: true,
                onTrigger: () => updateSettings({ savedImageAttribution: !settings.savedImageAttribution }),
              },
            )}
          />
          <ListItem
            label={s.settings_comment_jump}
            Icon={IcArrowDown}
            hasSwitch
            checked={true}
            onSwitchChange={() => {}}
          />
          <ListItem
            label={s.settings_default_comment_sort}
            Icon={IcComment}
            rightText={s.settings_best}
            hasDropdown
            {...bindTap(
              { kind: 'action', id: 'settings.defaultCommentSort.select' } as any,
              { onTrigger: () => {} },
            )}
          />
          <ListItem
            label={s.settings_export_video_log}
            Icon={IcHelp}
            hasArrow
          />
        </div>

        {/* ═══ About ═══ */}
        <SectionHeader title={s.settings_section_about} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_reddit_rules}
            Icon={IcFile}
            hasArrow
          />
          <ListItem
            label={s.settings_privacy_policy}
            Icon={IcShield}
            hasArrow
          />
          <ListItem
            label={s.settings_user_agreement}
            Icon={IcUser}
            hasArrow
          />
          <ListItem
            label={s.settings_acknowledgements}
            Icon={IcFile}
            hasArrow
          />
        </div>

        {/* ═══ Support ═══ */}
        <SectionHeader title={s.settings_section_support} />
        <div className="bg-app-surface">
          <ListItem
            label={s.settings_help_center}
            Icon={IcHelp}
            hasArrow
          />
          <ListItem
            label={s.settings_visit_bugs}
            iconNode={
              <svg className="w-5 h-5 text-app-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
            }
            hasArrow
          />
          <ListItem
            label={s.settings_report_issue}
            Icon={IcMail}
            hasArrow
          />
        </div>

        {/* ═══ Build Information ═══ */}
        <SectionHeader title={s.settings_section_build} />
        <div className="bg-app-surface">
          <ListItem
            label="2026.05.1.2605050"
            hasArrow
          />
        </div>

        <div className="h-8" />
      </div>

      {/* Open links bottom sheet */}
      {openLinksSheetOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => back()}
            aria-label="Close open links sheet"
          />
          <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-2xl shadow-xl">
            <div className="px-4 pt-4 pb-2">
              <div className="text-[12px] font-bold text-app-text-muted uppercase tracking-wide">{s.settings_open_links_header}</div>
            </div>
            <div className="px-2 pb-3">
              <button
                className="w-full flex items-center gap-3 px-4 py-4 rounded-lg active:bg-gray-100 text-left"
                {...bindTap(
                  { kind: 'action', id: 'settings.openLinks.select.inApp' },
                  {
                    onTrigger: () => {
                      updateSettings({ openLinksInApp: true });
                      back();
                    },
                  },
                )}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${settings.openLinksInApp ? 'border-app-text' : 'border-gray-300'}`}>
                  {settings.openLinksInApp && <div className="w-2.5 h-2.5 rounded-full bg-app-text" />}
                </div>
                <div className="flex-1">
                  <div className="text-[16px] text-app-text">{s.settings_in_app}</div>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-4 rounded-lg active:bg-gray-100 text-left"
                {...bindTap(
                  { kind: 'action', id: 'settings.openLinks.select.defaultBrowser' },
                  {
                    onTrigger: () => {
                      updateSettings({ openLinksInApp: false });
                      back();
                    },
                  },
                )}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!settings.openLinksInApp ? 'border-app-text' : 'border-gray-300'}`}>
                  {!settings.openLinksInApp && <div className="w-2.5 h-2.5 rounded-full bg-app-text" />}
                </div>
                <div className="flex-1">
                  <div className="text-[16px] text-app-text">{s.settings_default_browser}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
