import React from 'react';
import { IcExternalLink, IcNavBackArrow, IcNavForward } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const Header = ({ title }: { title: string }) => {
  const { bindBack } = useSpotifyGestures();

  return (
    <div className="sticky top-0 z-50 bg-app-surface pt-12 pb-2 mb-2">
      <div className="flex items-center gap-4 relative h-10">
        <button {...bindBack()} className="cursor-pointer z-10">
          <IcNavBackArrow size={24} />
        </button>
        <h1 className="text-base font-bold absolute w-full text-center left-0 pointer-events-none">{title}</h1>
      </div>
    </div>
  );
};

export const SectionHeader = ({ title }: { title: string }) => (
  <div className="text-white font-bold text-base mb-4 mt-6 px-1">{title}</div>
);

type RowTapProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonTapProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const ToggleRow = ({
  title,
  desc,
  isOn,
  onClick,
  tapProps,
}: {
  title: string;
  desc?: string;
  isOn: boolean;
  onClick?: () => void;
  tapProps?: RowTapProps;
}) => {
  const { className, onClick: tapOnClick, ...rest } = tapProps ?? {};

  return (
    <div
      {...rest}
      className={`flex items-center justify-between py-3 cursor-pointer active:bg-white/5 rounded px-1 -mx-1 ${className ?? ''}`}
      onClick={tapOnClick ?? onClick}
    >
      <div className="flex-1 pr-4">
        <div className="text-base text-white">{title}</div>
        {desc && <div className="text-gray-400 text-xs mt-1 leading-normal whitespace-pre-line">{desc}</div>}
      </div>
      <div className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${isOn ? 'bg-app-accent' : 'bg-white/20'}`}>
        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${isOn ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  );
};

export const LinkRow = ({
  title,
  desc,
  value,
  onClick,
  tapProps,
}: {
  title: string;
  desc?: string;
  value?: string;
  onClick?: () => void;
  tapProps?: RowTapProps;
}) => {
  const { className, onClick: tapOnClick, ...rest } = tapProps ?? {};

  return (
    <div
      {...rest}
      className={`flex items-center justify-between py-3 cursor-pointer active:bg-white/5 rounded px-1 -mx-1 ${className ?? ''}`}
      onClick={tapOnClick ?? onClick}
    >
      <div className="flex-1">
        <div className="text-base text-white">{title}</div>
        {desc && <div className="text-gray-400 text-xs mt-1">{desc}</div>}
      </div>
      {value && <div className="text-gray-400 text-sm mr-2">{value}</div>}
      <IcNavForward className="text-gray-400" size={20} />
    </div>
  );
};

export const InfoText = ({ text }: { text: string }) => (
  <div className="text-gray-400 text-xs mt-2 leading-normal px-1">{text}</div>
);

export const AppRow = ({
  iconSrc,
  name,
  btnText,
  onClick,
  buttonProps,
}: {
  iconSrc: string;
  name: string;
  btnText?: string;
  onClick?: () => void;
  buttonProps?: ButtonTapProps;
}) => {
  const s = useSpotifyStrings();
  const { className, onClick: buttonOnClick, ...rest } = buttonProps ?? {};

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        <img src={iconSrc} alt={name} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
        <div className="text-base font-medium">{name}</div>
      </div>
      <button
        {...rest}
        onClick={buttonOnClick ?? onClick}
        className={`border border-gray-500 rounded-full px-4 py-1.5 text-sm font-bold active:scale-95 transition-transform ${className ?? ''}`}
      >
        {btnText ?? s.apps_get_app}
      </button>
    </div>
  );
};

export const RadioRow = ({
  label,
  selected,
  onClick,
  showPremium,
  tapProps,
}: {
  label: string;
  selected: boolean;
  onClick?: () => void;
  showPremium?: boolean;
  tapProps?: RowTapProps;
}) => {
  const { className, onClick: tapOnClick, ...rest } = tapProps ?? {};

  return (
    <div
      {...rest}
      className={`flex items-center justify-between py-3 cursor-pointer active:bg-white/5 rounded px-1 -mx-1 ${className ?? ''}`}
      onClick={tapOnClick ?? onClick}
    >
      <div className="text-base text-white">{label}</div>
      <div className="flex items-center gap-3">
        {showPremium && (
          <span className="text-app-accent text-xs font-bold flex items-center gap-1">
            <span className="bg-app-accent text-black rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-[10px]">S</span>
            Premium
          </span>
        )}
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-app-accent' : 'border-gray-500'}`}>
          {selected && <div className="w-2.5 h-2.5 bg-app-accent rounded-full" />}
        </div>
      </div>
    </div>
  );
};

export const TextIconRow = ({
  title,
  value,
  onClick,
  icon: Icon = IcNavForward,
  linkIcon,
  tapProps,
}: {
  title: string;
  value?: string;
  onClick?: () => void;
  icon?: any;
  linkIcon?: boolean;
  tapProps?: RowTapProps;
}) => {
  const { className, onClick: tapOnClick, ...rest } = tapProps ?? {};

  return (
    <div
      {...rest}
      className={`flex items-center justify-between py-3 cursor-pointer active:bg-white/5 rounded px-1 -mx-1 ${className ?? ''}`}
      onClick={tapOnClick ?? onClick}
    >
      <div className="text-base text-white">{title}</div>
      <div className="flex items-center gap-2">
        {value && <span className="text-gray-400 text-sm">{value}</span>}
        {linkIcon ? <IcExternalLink className="text-gray-400" size={20} /> : <Icon className="text-gray-400" size={20} />}
      </div>
    </div>
  );
};
