
import React, { useState, useMemo } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcCamera, IcNavBack, IcSearch, IcMic, IcAdd } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { matchContact } from '../../utils/pinyinSearch';
import { SEARCHABLE_FEATURES, type SearchableFeature } from '../../constants';
import type { UserSettings } from '../../types';

/**
 * 按点分隔路径读取 settings 下的 boolean,仅支持 'settings.*' 前缀。
 * 比在 Search.tsx 里写死每个 feature 的 selector 简洁。
 *
 * 非 boolean 终值视为配置错误,开发环境下 warn,生产环境静默 false(安全默认)。
 */
function resolveSettingsBool(settings: UserSettings, ref: string): boolean {
  const parts = ref.split('.');
  if (parts[0] !== 'settings') return false;
  let cur: any = settings;
  for (let i = 1; i < parts.length; i++) {
    if (cur == null) return false;
    cur = cur[parts[i]];
  }
  if (typeof cur !== 'boolean') {
    if (import.meta.env.DEV) {
      console.warn(`[Search] enabledRef ${JSON.stringify(ref)} resolved to non-boolean:`, cur);
    }
    return false;
  }
  return cur;
}

const SearchSectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 py-2 border-t border-(--app-c-tw-border-gray-100) text-(--app-contacts-section-header-text-size) text-(--app-c-settings-item-extra-text)">
    {title}
  </div>
);

export const SearchPage: React.FC = () => {
  const t = useWechatStrings();
  const { bindBack, bindTap } = useWechatGestures();
  const contacts = useWechatStore(s => s.contacts);
  const settings = useWechatStore(s => s.settings);
  const [query, setQuery] = useState('');

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return [];
    return contacts.filter(c => matchContact(c, query));
  }, [contacts, query]);

  const filteredFeatures = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCHABLE_FEATURES.filter(f => t[f.nameKey].toLowerCase().includes(q));
  }, [query, t]);

  /**
   * 为 feature 行绑定 tap。
   *
   * Transition id 必须是 bind 点的字面量(CLAUDE.md §DOM Tagging),
   * 因此在这里对 feature.id 做 switch;新增 feature 时在此追加 case。
   * 字面量与 constants.ts 中 SEARCHABLE_FEATURES[*].gate.enabledTransitionId / disabledTransitionId 保持同步。
   */
  const bindFeatureTap = (f: SearchableFeature) => {
    if (f.gate) {
      const enabled = resolveSettingsBool(settings, f.gate.enabledRef);
      switch (f.id) {
        case 'wechatSports':
          return enabled
            ? bindTap<HTMLDivElement>('discover.search.feature.wechatSports.open')
            : bindTap<HTMLDivElement>('discover.search.feature.wechatSports.enable.open');
      }
    }
    // 未注册的 feature 或未实现的 route-only 分支:返回 undefined 会使点击静默无反应。
    // 新增 feature 时必须在上方 switch 或下方 TODO 处补写 bindTap 字面量。
    // TODO: 支持 feature.route + feature.routeTransitionId 的直跳分支。
    if (import.meta.env.DEV) {
      console.warn(`[Search] feature ${JSON.stringify(f.id)} has no registered bindTap handler`);
    }
    return undefined;
  };

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && filteredContacts.length === 0 && filteredFeatures.length === 0;

  return (
    <div className="bg-app-surface min-h-screen flex flex-col">
      {/* Header Search Bar */}
      <div className="px-4 pt-10 pb-4 flex items-center gap-3">
        <button {...bindBack<HTMLButtonElement>()} className="text-app-text active:opacity-60 flex-shrink-0">
          <IcNavBack size={dimens.icSizeNav} />
        </button>
        <div className="flex-1 bg-(--app-c-chat-input-bar-bg) rounded-[6px] h-(--app-card-height-40) flex items-center px-3 gap-2">
          <IcSearch size={dimens.icSizeAction} className="text-(--app-c-tw-text-gray-400)" />
          <input
            type="text"
            placeholder={t.common_search}
            className="bg-transparent flex-1 outline-none text-(--app-chat-bubble-text-size) text-app-text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <IcMic size={dimens.icSizeAction} className="text-(--app-c-tw-text-gray-400) cursor-pointer active:text-black" />
        </div>
      </div>

      {/* Function Row — 仅在无搜索词时显示 */}
      {!hasQuery && (
        <div className="flex items-center justify-between px-5 mt-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 cursor-pointer active:opacity-60">
              <div className="w-4 h-4 rounded-full border border-(--app-c-tw-border-gray-300) flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              </div>
              <span className="text-(--app-search-filter-text-size) text-(--app-c-settings-item-extra-text)">深度思考</span>
            </div>
            <div className="h-4 w-(--app-discover-search-width-1) bg-(--app-c-tw-bg-gray-200)"></div>
            <IcCamera size={dimens.icSizeCheck} className="text-(--app-c-settings-item-extra-text) cursor-pointer active:opacity-60" />
            <IcAdd size={dimens.icSizeCheck} className="text-(--app-c-settings-item-extra-text) cursor-pointer active:opacity-60" />
          </div>
          <div className="text-(--app-c-address-link-text) text-(--app-search-filter-text-size) font-medium cursor-pointer active:opacity-60">
            AI搜索
          </div>
        </div>
      )}

      {/* 搜索结果列表 */}
      {hasQuery && (
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length > 0 && (
            <div>
              <SearchSectionHeader title={t.search_section_contacts} />
              {filteredContacts.map(contact => (
                <div
                  key={contact.wxid}
                  {...bindTap<HTMLDivElement>('chat.open', { params: { id: contact.wxid } })}
                  className="flex items-center gap-3 px-4 py-2.5 active:bg-black/5 cursor-pointer"
                >
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="flex-shrink-0 rounded-[4px]"
                    style={{ width: dimens.search_result_avatar_size, height: dimens.search_result_avatar_size }}
                  />
                  <span className="text-(--app-search-result-text-size) text-app-text truncate">
                    {contact.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          {filteredFeatures.length > 0 && (
            <div>
              <SearchSectionHeader title={t.search_section_features} />
              {filteredFeatures.map(feature => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.id}
                    {...bindFeatureTap(feature)}
                    className="flex items-center gap-3 px-4 py-2.5 active:bg-black/5 cursor-pointer"
                  >
                    <div
                      className={`${feature.iconBg} flex items-center justify-center rounded-[4px] flex-shrink-0`}
                      style={{ width: dimens.search_result_avatar_size, height: dimens.search_result_avatar_size }}
                    >
                      <Icon size={dimens.icSizeAction} className="text-white" fill="white" />
                    </div>
                    <span className="text-(--app-search-result-text-size) text-app-text truncate">
                      {t[feature.nameKey]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {noResults && (
            <div className="flex items-center justify-center py-16 text-(--app-c-settings-item-extra-text) text-(--app-settings-group-title-size)">
              未找到相关结果
            </div>
          )}
        </div>
      )}

      {/* 无搜索词时的空区域 + 底部设置 */}
      {!hasQuery && (
        <>
          <div className="flex-1"></div>
          <div className="pb-10 text-center">
            <button className="text-(--app-c-address-link-text) text-(--app-settings-group-title-size) font-medium active:opacity-60">
              页面设置
            </button>
          </div>
        </>
      )}
    </div>
  );
};
