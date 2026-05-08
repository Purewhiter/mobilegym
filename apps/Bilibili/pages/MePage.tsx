import React from 'react';
import {
    IcScan, IcSkin, IcMoon, IcNavForward, IcDownload, IcHistory, IcStar, IcMonitorPlay,
    IcGaming, IcShoppingBag, IcFlame, IcLightbulb, IcMessage, IcHeart, IcAnime,
    IcBroadcast, IcBookOpen, IcWallet, IcVideo, IcImage, IcBatteryCharge, IcTicket, IcCalendar,
    IcHeadphone, IcShield, IcSettings, IcVolume, IcRadio, IcEdit
} from '../res/icons';
import { useLocale } from '@/apps/Bilibili/locale';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';

const Scan = IcScan;
const Shirt = IcSkin;
const Moon = IcMoon;
const ChevronRight = IcNavForward;
const Download = IcDownload;
const History = IcHistory;
const Star = IcStar;
const MonitorPlay = IcMonitorPlay;
const Gamepad2 = IcGaming;
const ShoppingBag = IcShoppingBag;
const Flame = IcFlame;
const Lightbulb = IcLightbulb;
const MessageSquare = IcMessage;
const Heart = IcHeart;
const Tv = IcAnime;
const Cast = IcBroadcast;
const BookOpen = IcBookOpen;
const Wallet = IcWallet;
const Video = IcVideo;
const Image = IcImage;
const BatteryCharging = IcBatteryCharge;
const Ticket = IcTicket;
const Calendar = IcCalendar;
const Headphones = IcHeadphone;
const Shield = IcShield;
const Settings = IcSettings;
const Radio = IcRadio;
const PencilLine = IcEdit;

const ServiceItem = ({ icon: Icon, label, color = '#FB7299' }: any) => (
    <div className="flex flex-col items-center justify-center gap-2 py-3 active:scale-95 transition-transform">
        <Icon size={26} color={color} strokeWidth={1.5} />
        <span className="text-[11px] text-app-text text-center">{label}</span>
    </div>
);

const MoreServiceItem = ({ icon: Icon, label }: any) => (
    <div className="flex items-center justify-between py-3.5 px-2 active:bg-gray-50">
        <div className="flex items-center gap-3">
            <Icon size={20} className="text-app-primary" strokeWidth={1.8} />
            <span className="text-[15px] text-app-text font-medium">{label}</span>
        </div>
        <ChevronRight size={16} className="text-gray-300" />
    </div>
);

export const MePage: React.FC = () => {
    const { user } = useBilibiliStore();
    const { bindTap } = useBilibiliGestures();
    const locale = useLocale();
    const text = locale === 'en'
        ? {
            challenge: 'Take the membership quiz',
            setNickname: 'Tap to set a nickname',
            vip: 'Premium',
            regularMember: 'Member',
            bCoins: 'B-coins',
            coins: 'Coins',
            space: 'Profile',
            dynamics: 'Posts',
            following: 'Following',
            fans: 'Followers',
            upgradeVip: 'Go Premium',
            vipCenter: 'Premium Center',
            vipDesc: 'Unlock exclusive offline perks',
            offline: 'Offline cache',
            history: 'History',
            favorites: 'Favorites',
            watchLater: 'Watch Later',
            creatorTitle: 'Post your first video',
            creatorDesc: 'Unlock a limited avatar accessory and earn event rewards',
            creatorAction: 'Reward Post',
            myServices: 'My Services',
            courses: 'My Courses',
            dataFree: 'Zero-data Service',
            dressUp: 'Themes',
            wallet: 'My Wallet',
            games: 'Game Center',
            shopOrders: 'Shop Orders',
            lives: 'My Live',
            manga: 'Comics',
            promote: 'Boost Traffic',
            createCenter: 'Creator Center',
            community: 'Community',
            charity: 'Charity',
            energy: 'Energy Station',
            coupons: 'Dimensional Coupons',
            report: 'Year in Review',
            moreServices: 'More Services',
            contact: 'Contact Support',
            audio: 'Audio Mode',
            guardian: 'Minor Protection',
            settings: 'Settings',
        }
        : {
            challenge: '挑战转正答题',
            setNickname: '点击设置昵称',
            vip: '大会员',
            regularMember: '注册会员',
            bCoins: 'B币',
            coins: '硬币',
            space: '空间',
            dynamics: '动态',
            following: '关注',
            fans: '粉丝',
            upgradeVip: '成为大会员',
            vipCenter: '会员中心',
            vipDesc: '解锁线下专属权益',
            offline: '离线缓存',
            history: '历史记录',
            favorites: '我的收藏',
            watchLater: '稍后再看',
            creatorTitle: '发布你的第一个视频',
            creatorDesc: '领限定头像挂件，赢活动奖金',
            creatorAction: '有奖发布',
            myServices: '我的服务',
            courses: '我的课程',
            dataFree: '免流量服务',
            dressUp: '个性装扮',
            wallet: '我的钱包',
            games: '游戏中心',
            shopOrders: '会员购订单',
            lives: '我的直播',
            manga: '漫画',
            promote: '必火推广',
            createCenter: '创作中心',
            community: '社区中心',
            charity: '公益',
            energy: '能量加油站',
            coupons: '次元消费券',
            report: '年度报告',
            moreServices: '更多服务',
            contact: '联系客服',
            audio: '听视频',
            guardian: '未成年人守护',
            settings: '设置',
        };

    return (
        <div className="flex flex-col h-full bg-app-bg overflow-hidden">
            <div className="flex-shrink-0 bg-app-surface z-10 relative shadow-sm pb-1">
                <div className="flex justify-between items-center px-4 pt-12 pb-2">
                    <div className="bg-[#FFCC33]/20 text-[#FF9900] px-3 py-1 rounded-full flex items-center gap-1 text-xs font-medium">
                        <span>{text.challenge}</span>
                        <ChevronRight size={12} />
                    </div>

                    <div className="flex items-center gap-5 text-[#61666D]">
                        <Cast size={22} strokeWidth={1.5} />
                        <Scan size={22} strokeWidth={1.5} />
                        <Shirt size={22} strokeWidth={1.5} />
                        <Moon size={22} strokeWidth={1.5} />
                    </div>
                </div>

                <div className="px-5 pb-4">
                    <div
                        className="flex items-center gap-4 mt-2 active:bg-gray-50 transition-colors rounded-lg -mx-2 px-2 py-2 cursor-pointer"
                        {...bindTap('space.open')}
                    >
                        <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden relative flex-shrink-0">
                            {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-[#E3E5E7]">
                                    <Tv size={32} strokeWidth={1.5} />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-app-text truncate max-w-[60%]">
                                    {user.name || text.setNickname}
                                </h2>
                                <div
                                    className="p-1 text-gray-400 active:text-app-primary transition-colors"
                                    {...bindTap('profileEdit.open', { stopPropagation: true })}
                                >
                                    <PencilLine size={16} />
                                </div>
                                <span className="text-[10px] bg-[#C0C4CC] text-white px-1 rounded-[2px] font-bold italic">
                                    LV{user.level || 0}
                                </span>
                            </div>

                            <div className="flex gap-2 mt-1.5 items-center">
                                {user.isVip ? (
                                    <span className="text-[10px] text-white px-1.5 rounded-full bg-app-primary">
                                        {text.vip}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-app-primary px-1 rounded border border-app-primary/30">
                                        {text.regularMember}
                                    </span>
                                )}
                            </div>

                            <div className="text-xs text-gray-400 mt-2 flex gap-4">
                                <span>{text.bCoins}: {user.bCoins.toFixed(1)}</span>
                                <span>{text.coins}: {user.coins}</span>
                            </div>
                        </div>

                        <div className="flex items-center text-gray-400 text-xs self-start mt-2">
                            {text.space} <ChevronRight size={14} />
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-6 px-4">
                        <div className="flex flex-col items-center gap-1 flex-1">
                            <div className="font-medium text-lg text-app-text">{user.dynamic}</div>
                            <div className="text-xs text-gray-400">{text.dynamics}</div>
                        </div>
                        <div className="w-[1px] h-3 bg-gray-200"></div>
                        <div
                            className="flex flex-col items-center gap-1 flex-1 active:opacity-60 cursor-pointer"
                            {...bindTap('userRelation.open', { params: { tab: 'follow' } })}
                        >
                            <div className="font-medium text-lg text-app-text">{user.followingList?.length || 0}</div>
                            <div className="text-xs text-gray-400">{text.following}</div>
                        </div>
                        <div className="w-[1px] h-3 bg-gray-200"></div>
                        <div
                            className="flex flex-col items-center gap-1 flex-1 active:opacity-60 cursor-pointer"
                            {...bindTap('userRelation.open', { params: { tab: 'fans' } })}
                        >
                            <div className="font-medium text-lg text-app-text">{user.followersList?.length || 0}</div>
                            <div className="text-xs text-gray-400">{text.fans}</div>
                        </div>
                    </div>
                </div>

                <div className="px-3 pb-3">
                    <div className="bg-gradient-to-r from-[#FFEFF4] to-white rounded-xl p-3.5 flex justify-between items-center shadow-sm border border-pink-50/50">
                        <div>
                            <div className="flex items-center gap-1.5">
                                <div className="bg-app-primary rounded-full p-0.5">
                                    <Star size={10} className="text-white fill-current" />
                                </div>
                                <h3 className="text-app-primary font-bold text-sm">{text.upgradeVip}</h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 ml-0.5">{text.vipDesc} <ChevronRight size={10} className="inline" /></p>
                        </div>
                        <button
                            className="bg-app-primary text-white text-[13px] font-medium px-3.5 py-1.5 rounded-full shadow-sm shadow-[#FB7299]/30"
                            {...bindTap('vip.open')}
                        >
                            {text.vipCenter}
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto no-scrollbar pb-4 pt-2 bg-app-surface"
                data-scroll-container="main"
                data-scroll-direction="vertical"
            >
                <div className="grid grid-cols-4 mb-2 px-2">
                    <ServiceItem icon={Download} label={text.offline} color="#2FB3FF" />
                    <ServiceItem icon={History} label={text.history} color="#2FB3FF" />
                    <div {...bindTap('favorites.open')}>
                        <ServiceItem icon={Star} label={text.favorites} color="#2FB3FF" />
                    </div>
                    <ServiceItem icon={MonitorPlay} label={text.watchLater} color="#2FB3FF" />
                </div>

                <div className="mx-4 mb-4 mt-2">
                    <div className="bg-gradient-to-r from-[#FFF1F5] to-white rounded-lg p-3 flex justify-between items-center shadow-sm border border-pink-50">
                        <div className="flex items-center gap-3">
                            <div className="bg-app-primary w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                UP
                            </div>
                            <div>
                                <div className="text-[14px] font-bold text-app-text">{text.creatorTitle}</div>
                                <div className="text-[11px] text-gray-400 mt-0.5">{text.creatorDesc}</div>
                            </div>
                        </div>
                        <button className="bg-app-primary text-white text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm active:scale-95 transition-transform">
                            <Download size={12} /> {text.creatorAction}
                        </button>
                    </div>
                </div>

                <div className="px-5 mb-1">
                    <h3 className="font-bold text-[15px] text-app-text">{text.myServices}</h3>
                </div>

                <div className="grid grid-cols-4 gap-y-1 mb-4 px-2">
                    <ServiceItem icon={BookOpen} label={text.courses} />
                    <ServiceItem icon={Tv} label={text.dataFree} />
                    <ServiceItem icon={Shirt} label={text.dressUp} />
                    <ServiceItem icon={Wallet} label={text.wallet} />

                    <ServiceItem icon={Gamepad2} label={text.games} />
                    <ServiceItem icon={ShoppingBag} label={text.shopOrders} />
                    <ServiceItem icon={Video} label={text.lives} />
                    <ServiceItem icon={Image} label={text.manga} />

                    <ServiceItem icon={Flame} label={text.promote} />
                    <ServiceItem icon={Lightbulb} label={text.createCenter} />
                    <ServiceItem icon={MessageSquare} label={text.community} />
                    <ServiceItem icon={Heart} label={text.charity} />

                    <ServiceItem icon={BatteryCharging} label={text.energy} />
                    <ServiceItem icon={Ticket} label={text.coupons} />
                    <ServiceItem icon={Calendar} label={text.report} />
                </div>

                <div className="px-5 mb-1">
                    <h3 className="font-bold text-[15px] text-app-text">{text.moreServices}</h3>
                </div>

                <div className="px-3 mb-2">
                    <MoreServiceItem icon={Headphones} label={text.contact} />
                    <MoreServiceItem icon={Radio} label={text.audio} />
                    <MoreServiceItem icon={Shield} label={text.guardian} />
                    <div {...bindTap('settings.open')}>
                        <MoreServiceItem icon={Settings} label={text.settings} />
                    </div>
                </div>
            </div>
        </div>
    );
};
