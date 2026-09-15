import { SCROLL_LAB_ITEMS } from '../data';
import { useScrollLabGestures } from '../hooks/useScrollLabGestures';
import { useScrollLabStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useLocale } from '@/os/locale';
import { itemPreview, itemTitle } from './itemText';

const rowClass = {
  compact: 'min-h-[72px]',
  regular: 'min-h-[84px]',
  expanded: 'min-h-[96px]',
} as const;

export function ScrollLabListPage() {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale() === 'en' ? 'en' : 'zh';
  const { bindTap } = useScrollLabGestures();

  return (
    <div
      className="h-full bg-app-bg text-app-text flex flex-col pt-10"
      data-status-bar-foreground="dark"
    >
      <header className="flex-shrink-0 px-5 pt-3 pb-4 bg-app-surface border-b border-app-border">
        <h1 className="text-[24px] font-semibold tracking-tight">{s.app_name}</h1>
        <p className="text-[13px] text-app-text-muted mt-1">{s.list_subtitle}</p>
      </header>

      <div
        className="flex-1 overflow-y-auto no-scrollbar bg-app-surface"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {SCROLL_LAB_ITEMS.map((item) => {
          const title = itemTitle(item, locale);
          return (
            <button
              key={item.id}
              type="button"
              aria-label={title}
              data-scroll-lab-item={item.id}
              className={`w-full px-5 py-3 text-left border-b border-app-border active:bg-blue-50 ${rowClass[item.rowSize]}`}
              {...bindTap<HTMLButtonElement>('scroll_lab.list.openItem', {
                params: { itemId: item.id },
                beforeTrigger: () => useScrollLabStore.getState().selectItem(item.id),
              })}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[16px] font-semibold flex-shrink-0" aria-hidden="true">
                  {title.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[16px] font-medium truncate block">{title}</span>
                  <p className="mt-1 text-[13px] leading-5 text-app-text-muted line-clamp-2">
                    {itemPreview(item, locale)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
