import React from 'react';
import {
    IcNavBack, IcAdd,
    IcAnime, IcMonitorPlay, IcClapperboard, IcFilm, IcMusic, IcMic,
    IcVideo, IcPainting, IcLightning, IcGaming, IcNews, IcKnowledge,
    IcAI, IcCar, IcSkin, IcHome, IcOutdoor, IcFitness, IcTrophy,
    IcHandcraft, IcFood, IcMaskDance, IcTravel, IcRural, IcPets,
    IcParenting, IcHeartPulse, IcHeart, IcVlog, IcLifestyle, IcLifeExp, IcList,
    IcTrend, IcStore, IcBan, IcGraduationCap
} from '../res/icons';
const ChevronLeft = IcNavBack, Plus = IcAdd, Tv = IcAnime, MonitorPlay = IcMonitorPlay, Clapperboard = IcClapperboard, Film = IcFilm, Music = IcMusic, Mic = IcMic, Video = IcVideo, Palette = IcPainting, Zap = IcLightning, Gamepad2 = IcGaming, Newspaper = IcNews, GraduationCap = IcGraduationCap, Cpu = IcAI, Car = IcCar, Shirt = IcSkin, Home = IcHome, Tent = IcOutdoor, Dumbbell = IcFitness, Trophy = IcTrophy, Scissors = IcHandcraft, Utensils = IcFood, VenetianMask = IcMaskDance, Plane = IcTravel, Sprout = IcRural, Cat = IcPets, Baby = IcParenting, HeartPulse = IcHeartPulse, Heart = IcHeart, Camera = IcVlog, Coffee = IcLifestyle, Wrench = IcLifeExp, LayoutList = IcList, TrendingUp = IcTrend, Store = IcStore, Ban = IcBan;
const Trophy2 = IcTrophy;
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
const CategoryItem = ({ icon: Icon, label, color = '#FB7299', opensRanking = false }: any) => {
    const { bindTap } = useBilibiliGestures();
    return (
        <div
            {...(opensRanking ? bindTap('ranking.open') : bindTap('partition.open', { params: { label } }))}
            className="flex flex-col items-center justify-center gap-3 py-4 active:scale-95 transition-transform cursor-pointer"
        >
            <Icon size={32} color={color} strokeWidth={1.5} />
            <span className="text-[13px] text-app-text text-center leading-tight">{label}</span>
        </div>
    );
};

export const PartitionsPage: React.FC = () => {
    const { bindBack } = useBilibiliGestures();

    return (
        <div className="flex flex-col h-full bg-app-surface overflow-hidden">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-2 bg-app-surface sticky top-0 z-10">
                <button {...bindBack()} className="p-1 -ml-2 relative z-20">
                    <ChevronLeft size={24} className="text-app-text" />
                </button>
                <h1 className="flex-1 text-center font-medium text-[17px] text-app-text -ml-6">分区</h1>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-10" data-scroll-container="main" data-scroll-direction="vertical">

                {/* Quick Access */}
                <div className="px-4 mt-2">
                    <h2 className="font-bold text-[16px] text-app-text mb-3">快捷访问</h2>
                    <div className="bg-[#F6F7F8] rounded-lg py-3 flex items-center justify-center gap-1 text-[#61666D] active:bg-gray-200 transition-colors">
                        <Plus size={18} />
                        <span className="text-[14px]">编辑</span>
                    </div>
                </div>

                {/* All Categories */}
                <div className="px-4 mt-8">
                    <h2 className="font-bold text-[16px] text-app-text mb-2">全部分区</h2>
                    <div className="grid grid-cols-4 gap-y-2">
                        <CategoryItem icon={Tv} label="番剧" color="#FFB74D" />
                        <CategoryItem icon={MonitorPlay} label="国创" color="#FF7043" />
                        <CategoryItem icon={Clapperboard} label="纪录片" color="#4FC3F7" />
                        <CategoryItem icon={Film} label="电影" color="#E57373" />

                        <CategoryItem icon={Tv} label="电视剧" color="#F06292" />
                        <CategoryItem icon={Mic} label="综艺" color="#BA68C8" />
                        <CategoryItem icon={Video} label="影视" color="#9575CD" />
                        <CategoryItem icon={Zap} label="娱乐" color="#7986CB" />

                        <CategoryItem icon={Music} label="音乐" color="#64B5F6" />
                        <CategoryItem icon={VenetianMask} label="舞蹈" color="#4DD0E1" />
                        <CategoryItem icon={MonitorPlay} label="动画" color="#4DB6AC" />
                        <CategoryItem icon={Palette} label="绘画" color="#81C784" />

                        <CategoryItem icon={Zap} label="鬼畜" color="#AED581" />
                        <CategoryItem icon={Gamepad2} label="游戏" color="#DCE775" />
                        <CategoryItem icon={Newspaper} label="资讯" color="#FFD54F" />
                        <CategoryItem icon={GraduationCap} label="知识" color="#FFCA28" />

                        <CategoryItem icon={Cpu} label="人工智能" color="#FFB300" />
                        <CategoryItem icon={Cpu} label="科技数码" color="#FFA000" />
                        <CategoryItem icon={Car} label="汽车" color="#FB8C00" />
                        <CategoryItem icon={Shirt} label="时尚美妆" color="#F4511E" />

                        <CategoryItem icon={Home} label="家装房产" color="#FF8A65" />
                        <CategoryItem icon={Tent} label="户外潮流" color="#A1887F" />
                        <CategoryItem icon={Dumbbell} label="健身" color="#90A4AE" />
                        <CategoryItem icon={Trophy} label="体育运动" color="#78909C" />

                        <CategoryItem icon={Scissors} label="手工" color="#FFAB91" />
                        <CategoryItem icon={Utensils} label="美食" color="#FFCC80" />
                        <CategoryItem icon={VenetianMask} label="小剧场" color="#CE93D8" />
                        <CategoryItem icon={Plane} label="旅游出行" color="#80CBC4" />

                        <CategoryItem icon={Sprout} label="三农" color="#A5D6A7" />
                        <CategoryItem icon={Cat} label="动物" color="#EF9A9A" />
                        <CategoryItem icon={Baby} label="亲子" color="#FFE082" />
                        <CategoryItem icon={HeartPulse} label="健康" color="#F48FB1" />

                        <CategoryItem icon={Heart} label="情感" color="#F44336" />
                        <CategoryItem icon={Camera} label="vlog" color="#9C27B0" />
                        <CategoryItem icon={Coffee} label="生活兴趣" color="#FFC107" />
                        <CategoryItem icon={Wrench} label="生活经验" color="#607D8B" />
                    </div>
                </div>

                {/* Recommended Services */}
                <div className="px-4 mt-8 pb-10">
                    <h2 className="font-bold text-[16px] text-app-text mb-2">推荐分区/服务</h2>
                    <div className="grid grid-cols-4 gap-y-2">
                        <CategoryItem icon={TrendingUp} label="全区排行榜" color="#F06292" opensRanking />
                        <CategoryItem icon={Music} label="新歌热榜" color="#4FC3F7" />
                        <CategoryItem icon={Store} label="工房集市" color="#FFB74D" />
                        <CategoryItem icon={Ban} label="小黑屋" color="#E57373" />

                        <CategoryItem icon={Gamepad2} label="游戏中心" color="#FFD54F" />
                        <CategoryItem icon={Trophy2} label="游戏赛事" color="#FFCA28" />
                        <CategoryItem icon={Palette} label="漫画" color="#9575CD" />
                        <CategoryItem icon={GraduationCap} label="课堂" color="#FFB300" />

                        <CategoryItem icon={LayoutList} label="专栏" color="#4DB6AC" />
                        <CategoryItem icon={MonitorPlay} label="超高清专区" color="#29B6F6" />
                    </div>
                </div>
            </div>
        </div>
    );
};
