
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcSearch, IcCheck } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocation } from 'react-router-dom';
export const SelectLocationPage: React.FC = () => {
  const t = useWechatStrings();
    const { back, bindTap } = useWechatGestures();
    const location = useLocation();
    const { momentDraft, updateMomentDraft, textMomentDraft, updateTextMomentDraft } = useWechatStore(useShallow(s => ({
        momentDraft: s.momentDraft,
        updateMomentDraft: s.updateMomentDraft,
        textMomentDraft: s.textMomentDraft,
        updateTextMomentDraft: s.updateTextMomentDraft,
    })));

    const searchParams = new URLSearchParams(location.search);
    const target = searchParams.get('target') === 'text' ? 'text' : 'moment';

    const selected =
        (target === 'text' ? textMomentDraft.location : momentDraft.location) || '不显示位置';

    const locations = [
        { id: 'postMoment.location.select.none', name: '不显示位置', desc: '' },
        { id: 'postMoment.location.select.beijing', name: '北京市', desc: '' },
        { id: 'postMoment.location.select.ucasYanqiCampus', name: '中国科学院大学(雁栖湖校校区)', desc: '352m | 北京市怀柔区怀北镇京加路中建雁栖湖景酒店旁' },
        { id: 'postMoment.location.select.ucasYanqiEastCampus', name: '中国科学院大学雁栖湖校校区(东校区)', desc: '118m | 北京市怀柔区怀北庄380号' },
        { id: 'postMoment.location.select.yanqiLake', name: '雁栖湖', desc: '512m | 北京市怀柔区雁水路3号' },
        { id: 'postMoment.location.select.yanqiHotel', name: '北京中建雁栖湖景酒店(雁秀路)', desc: '275m | 北京市怀柔区雁秀路1号' },
        { id: 'postMoment.location.select.ucasLibrary', name: '北京市·中国科学院大学雁栖湖校区图书馆', desc: '477m | 北京市怀柔区怀北庄380号' },
        { id: 'postMoment.location.select.artBuilding', name: '中国科学院大学科学与艺术大楼', desc: '100m内 | 北京市怀柔区中国科学院南路与怀丰公路东侧路交叉口' },
        { id: 'postMoment.location.select.sinoDanishCenter', name: '中国科学院大学(雁栖湖校区)中国丹麦科研教育中心', desc: '100m内 | 北京市怀柔区怀北镇G111(京加路)怀北庄380号' },
        { id: 'postMoment.location.select.auditorium', name: '中国科学院大学(雁栖湖校区)学生礼堂', desc: '239m | 北京市怀柔区怀北镇怀北庄中国科学院大学雁栖湖校校区' },
        { id: 'postMoment.location.select.meetingCenter', name: '北京国科大国际会议中心', desc: '321m | 北京市怀柔区雁栖湖' }
    ];

    const handleSelect = (locName: string) => {
        const finalLoc = locName === '不显示位置' ? null : locName;
        // 更新目标草稿中的位置（图文草稿 / 文字草稿互不影响）
        if (target === 'text') {
            updateTextMomentDraft({ location: finalLoc });
        } else {
            updateMomentDraft({ location: finalLoc });
        }
        // 按照要求物理返回，确保历史栈段的清除
        back();
    };

    // 规范：避免动态拼接/变量传入 actionId，确保静态工具可完全发现入口。
    const locationActionPropsOf = (id: string, name: string) => {
        switch (id) {
            case 'postMoment.location.select.none':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.none' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.beijing':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.beijing' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.ucasYanqiCampus':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.ucasYanqiCampus' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.ucasYanqiEastCampus':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.ucasYanqiEastCampus' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.yanqiLake':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.yanqiLake' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.yanqiHotel':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.yanqiHotel' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.ucasLibrary':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.ucasLibrary' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.artBuilding':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.artBuilding' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.sinoDanishCenter':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.sinoDanishCenter' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.auditorium':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.auditorium' }, { onTrigger: () => handleSelect(name) });
            case 'postMoment.location.select.meetingCenter':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.meetingCenter' }, { onTrigger: () => handleSelect(name) });
            default:
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'postMoment.location.select.none' }, { onTrigger: () => handleSelect(name) });
        }
    };

    return (
        <div className="bg-app-surface min-h-full flex flex-col">
            {/* 搜索框 */}
            <div className="px-4 py-2 bg-app-bg">
                <div className="bg-app-surface rounded-[6px] py-1.5 flex items-center justify-center text-(--app-c-settings-item-chevron) text-(--app-search-filter-text-size)">
                    <IcSearch size={dimens.icSizeChevronSm} className="mr-1.5" />
                    <span>{t.common_search}</span>
                </div>
            </div>

            {/* 列表 */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                {locations.map((loc, idx) => (
                    <div 
                        key={loc.id}
                        {...locationActionPropsOf(loc.id, loc.name)}
                        className="px-4 py-3 border-b border-(--app-c-tw-border-gray-50) active:bg-(--app-c-tw-bg-gray-50) cursor-pointer flex justify-between items-center"
                    >
                        <div className="flex-1 min-w-0 pr-4">
                            <div className={`text-(--app-settings-item-text-size) ${selected === loc.name ? 'text-app-primary' : 'text-app-text'} font-medium truncate`}>
                                {loc.name}
                            </div>
                            {loc.desc && (
                                <div className="text-(--app-chat-system-msg-text-size) text-(--app-c-tw-text-gray-400) mt-1 truncate">
                                    {loc.desc}
                                </div>
                            )}
                        </div>
                        {selected === loc.name && (
                            <div className="w-5 h-5 rounded-full bg-app-primary flex items-center justify-center">
                                <IcCheck size={dimens.icSizeXs} className="text-white" strokeWidth={4} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
