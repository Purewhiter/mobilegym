import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcUserAdd, IcBus, IcLightbulb, IcFile, IcClock, IcDownload, IcClipboard, IcCart, IcWallet, IcGrid, IcBookOpen, IcScan, IcHelp, IcSettings } from '../res/icons';
const UserPlus = IcUserAdd, Bus = IcBus, Lightbulb = IcLightbulb, FileText = IcFile, Clock = IcClock, Download = IcDownload, ClipboardList = IcClipboard, ShoppingCart = IcCart, Wallet = IcWallet, LayoutGrid = IcGrid, BookOpen = IcBookOpen, ScanLine = IcScan, HelpCircle = IcHelp, Settings = IcSettings;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
interface DrawerProps {
    isOpen: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen }) => {
    const { bindTap, bindBack } = useRedBookGestures();
    const s = useRedBookStrings();

    if (!isOpen) return null;

    const DrawerItem = ({
        icon: Icon,
        label,
        className,
        ...props
    }: {
        icon: any;
        label: string;
        className?: string;
        [key: string]: any;
    }) => (
        <div className={`flex items-center gap-3 py-[18px] px-4 active:bg-gray-50 ${className || ''}`} {...props}>
            <Icon size={22} className="text-gray-600" />
            <span className="text-[16px] text-gray-800">{label}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 transition-opacity" {...bindBack()} />
            
            {/* Drawer Content */}
            <div className="relative w-[75%] h-full bg-[#f5f5f5] animate-slide-in-left">
                <div className="h-full overflow-y-auto pt-20 px-3 no-scrollbar pb-[150px]">
                    {/* Group 1 */}
                    <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
                        <DrawerItem icon={UserPlus} label={s.discover_friends} {...bindTap('addFriend.open.fromDrawer')} />
                    </div>

                    {/* Group 2 */}
                    <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
                        <div className="flex items-center gap-3 py-[18px] px-4 active:bg-gray-50" {...bindBack()}>
                            <Bus size={22} className="text-app-primary" />
                            <span className="text-[16px] text-app-primary font-medium">{s.annual_report_2025}</span>
                        </div>
                    </div>

                    {/* Group 3 */}
                    <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
                        <DrawerItem icon={Lightbulb} label={s.creator_center} />
                    </div>

                    {/* Group 4 */}
                    <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
                        <DrawerItem icon={FileText} label={s.my_drafts} />
                        <DrawerItem icon={Clock} label={s.history} {...bindTap('history.open.fromDrawer')} />
                        <DrawerItem icon={Download} label={s.my_downloads} />
                    </div>
                    
                    {/* Group 5 */}
                    <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
                        <DrawerItem icon={ClipboardList} label={s.orders} />
                        <DrawerItem icon={ShoppingCart} label={s.shopping_cart} />
                        <DrawerItem icon={Wallet} label={s.wallet} />
                    </div>
                    
                    {/* Group 6 */}
                    <div className="bg-app-surface rounded-xl mb-5 overflow-hidden">
                        <DrawerItem icon={LayoutGrid} label={s.applets} />
                        <DrawerItem icon={BookOpen} label={s.community_guidelines} />
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="absolute bottom-0 left-0 right-0 px-8 pb-14 pt-10 flex items-center justify-between bg-[#f5f5f5] z-10">
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                        <div className="w-11 h-11 rounded-full bg-app-surface flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                            <ScanLine size={22} className="text-gray-700" />
                        </div>
                        <span className="text-[12px] font-medium">{s.scan}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                        <div className="w-11 h-11 rounded-full bg-app-surface flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                            <HelpCircle size={22} className="text-gray-700" />
                        </div>
                        <span className="text-[12px] font-medium">{s.help_and_support}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-gray-600" {...bindTap('settings.open.fromDrawer')}>
                        <div className="w-11 h-11 rounded-full bg-app-surface flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                            <Settings size={22} className="text-gray-700" />
                        </div>
                        <span className="text-[12px] font-medium">{s.settings}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};