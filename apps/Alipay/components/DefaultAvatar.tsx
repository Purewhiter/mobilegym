import { IcUser } from '../res/icons';

type DefaultAvatarProps = {
  iconSize?: number;
  className?: string;
};

export function DefaultAvatar({ iconSize = 20, className = '' }: DefaultAvatarProps) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gray-200 text-gray-400 ${className}`}>
      <IcUser size={iconSize} strokeWidth={1.8} />
    </div>
  );
}
