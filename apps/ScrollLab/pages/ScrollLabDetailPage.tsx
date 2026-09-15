import { useParams } from 'react-router-dom';
import { findScrollLabItem, SCROLL_LAB_ITEM_COUNT } from '../data';
import { useScrollLabGestures } from '../hooks/useScrollLabGestures';
import { useScrollLabStore } from '../state';
import { IcBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useLocale } from '@/os/locale';
import { itemPreview, itemTitle } from './itemText';

export function ScrollLabDetailPage() {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale() === 'en' ? 'en' : 'zh';
  const { itemId = '' } = useParams<{ itemId: string }>();
  const item = findScrollLabItem(itemId);
  const selectedItemId = useScrollLabStore((state) => state.selectedItemId);
  const { bindBack } = useScrollLabGestures();

  return (
    <div
      className="h-full bg-app-bg text-app-text flex flex-col pt-10"
      data-status-bar-foreground="dark"
    >
      <header className="h-14 px-3 flex items-center gap-2 bg-app-surface border-b border-app-border flex-shrink-0">
        <button
          type="button"
          aria-label="Back"
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100"
          {...bindBack<HTMLButtonElement>()}
        >
          <IcBack size={22} />
        </button>
        <span className="text-[16px] font-medium">{s.app_name}</span>
      </header>

      {!item ? (
        <div className="flex-1 flex items-center justify-center text-app-text-muted">
          {s.item_not_found}
        </div>
      ) : (
        <main className="flex-1 px-5 py-8">
          <div className="bg-app-surface rounded-3xl border border-app-border p-6 shadow-sm">
            <div className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
              {item.code}
            </div>
            <h1 className="mt-4 text-[25px] leading-8 font-semibold" data-scroll-lab-selected-title>
              {itemTitle(item, locale)}
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-app-text-muted">
              {itemPreview(item, locale)}
            </p>

            <div className="mt-7 pt-5 border-t border-app-border space-y-3 text-[14px]">
              <div className="flex justify-between gap-4">
                <span className="text-app-text-muted">{s.detail_position_prefix}</span>
                <span className="font-medium">
                  {item.ordinal} {s.detail_position_separator} {SCROLL_LAB_ITEM_COUNT}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-app-text-muted">{s.detail_code_prefix}</span>
                <span className="font-mono font-medium">{item.code}</span>
              </div>
            </div>

            <div
              className={`mt-6 rounded-2xl px-4 py-3 text-[13px] font-medium ${
                selectedItemId === item.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {selectedItemId === item.id ? s.detail_selected : s.detail_not_selected}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
