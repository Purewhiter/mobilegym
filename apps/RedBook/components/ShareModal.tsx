import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcLink, IcFlag, IcDownload, IcMore, IcUserAdd, IcImage, IcContacts, IcFrown, IcMessageCircle, IcTabHome, IcStar, IcEye, IcClose, IcMessage } from '../res/icons';
const Link = IcLink, Flag = IcFlag, Download = IcDownload, MoreHorizontal = IcMore, UserPlus = IcUserAdd, ImageIcon = IcImage, Users = IcContacts, Frown = IcFrown, MessageCircle = IcMessageCircle, Aperture = IcTabHome, Star = IcStar, Eye = IcEye, X = IcClose, MessageSquare = IcMessage;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
interface ShareModalProps {
  isOpen: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen }) => {
  const s = useRedBookStrings();
  const { bindBack } = useRedBookGestures();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 transition-opacity" {...bindBack()} />
      <div className="relative bg-[#f8f8f8] rounded-t-[16px] overflow-hidden animate-in slide-in-from-bottom duration-200">
        <div className="px-4 pb-8 pt-4 relative">
            <div className="text-center text-[16px] text-app-text mb-8 font-medium">{s.share_to}</div>
            <div className="absolute top-4 right-4 p-2 active:opacity-50" {...bindBack()}>
                <X size={20} className="text-app-text-muted" strokeWidth={2} />
            </div>
            
            {/* Row 1: Invite */}
            <div className="grid grid-cols-5 gap-y-2 mb-6">
                <ShareItem 
                    icon={<div className="w-full h-full bg-app-surface flex items-center justify-center text-app-text rounded-full"><UserPlus size={26} strokeWidth={1.5} /></div>} 
                    label={s.invite_friends}
                />
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>

            {/* Row 2: Social */}
            <div className="grid grid-cols-5 gap-y-2 mb-6">
                <ShareItem
                    icon={<div className="w-full h-full bg-app-primary flex items-center justify-center text-white rounded-full"><MessageSquare size={24} fill="white" strokeWidth={0} /></div>}
                    label={s.direct_message}
                />
                <ShareItem
                    icon={<div className="w-full h-full bg-[#07c160] flex items-center justify-center text-white rounded-full"><MessageCircle size={28} fill="white" strokeWidth={0} /></div>}
                    label={s.wechat}
                />
                <ShareItem
                    icon={<div className="w-full h-full bg-[#6ccc43] flex items-center justify-center text-white rounded-full"><Aperture size={28} fill="white" strokeWidth={0} /></div>}
                    label={s.moments}
                />
                <ShareItem
                    icon={<div className="w-full h-full bg-[#12b7f5] flex items-center justify-center text-white rounded-full"><span className="font-bold text-base">{s.sharemodal_qq}</span></div>}
                    label={s.sharemodal_qq}
                />
                <ShareItem
                    icon={<div className="w-full h-full bg-[#fcc600] flex items-center justify-center text-white rounded-full"><Star size={26} fill="white" strokeWidth={0} /></div>}
                    label={s.qq_zone}
                />
            </div>
            
            {/* Row 3: Actions */}
            <div className="grid grid-cols-5 gap-y-2">
                <ShareItem icon={<Link size={24} className="text-[#666]" strokeWidth={1.5} />} label={s.copy_link} bg="bg-app-surface" />
                <ShareItem icon={<ImageIcon size={24} className="text-[#666]" strokeWidth={1.5} />} label={s.generate_share_image} bg="bg-app-surface" />
                <ShareItem icon={<Users size={24} className="text-[#666]" strokeWidth={1.5} />} label={s.share_to_group} bg="bg-app-surface" />
                <ShareItem icon={<Download size={24} className="text-[#666]" strokeWidth={1.5} />} label={s.save_image} bg="bg-app-surface" />
                <ShareItem icon={<Frown size={24} className="text-[#666]" strokeWidth={1.5} />} label={s.not_interested} bg="bg-app-surface" />
            </div>
        </div>
      </div>
    </div>
  );
};

const ShareItem = ({ icon, label, bg }: { icon: React.ReactNode, label: string, bg?: string }) => (
    <div className="flex flex-col items-center gap-2 w-full cursor-pointer active:opacity-70 transition-opacity">
        <div className={`w-[52px] h-[52px] rounded-full ${bg || ''} flex items-center justify-center`}>
            {icon}
        </div>
        <span className="text-[11px] text-[#666] whitespace-nowrap">{label}</span>
    </div>
);