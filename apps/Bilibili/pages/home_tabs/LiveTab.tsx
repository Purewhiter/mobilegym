
import { IcPlay, IcUser, IcHeart } from '../../res/icons';
import { useLocale } from '@/apps/Bilibili/locale';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';
const Play = IcPlay, User = IcUser, Heart = IcHeart;

// 内容型 mock 数据：双字段（zh/en），与 SearchPage 的 HOT_SEARCHES 同一模式
const BANNER = {
    titleZh: '东部战区开展“正义使命-2025”...',
    titleEn: 'Eastern Theater launches "Mission Justice 2025"...',
    subtitleZh: '四川观察 24小时直播',
    subtitleEn: 'Sichuan Observer · 24h live',
};
const LIVE_TITLES = [
    { zh: '想看什么进来', en: 'Come in and take a look' },
    { zh: '超美丽3D:水逆退散', en: 'Gorgeous 3D: bad luck begone' },
    { zh: '千人在线睡觉', en: 'Sleeping live with 1,000 viewers' },
    { zh: '白噪音 24小时直播', en: 'White noise · 24h live' },
];
const LIVE_HOSTS = [
    { zh: '晓娇柔', en: 'Xiaojiaorou' },
    { zh: 'runningpig66', en: 'runningpig66' },
    { zh: '咕咕berry', en: 'Guguberry' },
];
const LIVE_AREAS = [
    { zh: '虚拟日常', en: 'Virtual daily' },
    { zh: '自习室', en: 'Study room' },
    { zh: '沉浸体验', en: 'Immersive' },
];

export const LiveTab: React.FC = () => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const s = useBilibiliStrings();
    const liveCats = [
        s.live_cat_popularity,
        s.live_cat_beauty,
        s.live_cat_lol,
        s.live_cat_vtuber,
        s.live_cat_honor,
        s.live_cat_single,
        s.live_cat_radio,
    ];
    return (
        <div className="pb-20">
            {/* 顶部 Banner / 正在直播推荐 */}
            <div className="p-3">
                <div className="aspect-video w-full bg-black rounded-lg relative overflow-hidden group">
                    {/* 模拟直播画面 */}
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-sky-700 to-pink-500 opacity-80" />
                    <div className="absolute top-2 right-2 bg-app-primary text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-app-surface rounded-full animate-pulse" />
                        {s.live_badge}
                    </div>
                    <div className="absolute bottom-4 left-4 text-white">
                        <div className="text-lg font-bold">{isEnglish ? BANNER.titleEn : BANNER.titleZh}</div>
                        <div className="text-xs opacity-80 mt-1">{isEnglish ? BANNER.subtitleEn : BANNER.subtitleZh}</div>
                    </div>
                </div>
            </div>

            {/* 子分区 */}
            <div className="flex gap-6 px-4 py-2 overflow-x-auto text-sm text-gray-600 border-b border-gray-100 no-scrollbar">
                <span className="font-bold text-app-primary whitespace-nowrap">{s.live_cat_recommend}</span>
                {liveCats.map(tab => (
                    <span key={tab} className="whitespace-nowrap">{tab}</span>
                ))}
            </div>

            {/* 直播列表 */}
            <div className="grid grid-cols-2 gap-3 p-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-app-surface rounded-lg overflow-hidden shadow-sm">
                        <div className="relative aspect-video bg-gray-100">
                            <div className={`w-full h-full bg-gradient-to-br ${i % 2 ? 'from-cyan-100 via-sky-200 to-violet-200' : 'from-amber-100 via-pink-100 to-sky-200'}`} />
                            <div className="absolute bottom-1 left-1 text-[10px] text-white bg-black/40 px-1 rounded flex items-center gap-1">
                                <User size={10} />
                                <span>{Math.floor(Math.random() * 10000)}</span>
                            </div>
                        </div>
                        <div className="p-2">
                            <div className="text-sm line-clamp-1 font-medium text-gray-800">
                                {isEnglish ? LIVE_TITLES[i % 4]!.en : LIVE_TITLES[i % 4]!.zh}
                            </div>
                            <div className="mt-1 flex justify-between items-center text-xs text-gray-400">
                                <span>{isEnglish ? LIVE_HOSTS[i % 3]!.en : LIVE_HOSTS[i % 3]!.zh}</span>
                            </div>
                            <div className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                                <span className="border border-app-border px-1 rounded scale-90 origin-left">
                                    {isEnglish ? LIVE_AREAS[i % 3]!.en : LIVE_AREAS[i % 3]!.zh}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
