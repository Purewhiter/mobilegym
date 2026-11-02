import { useParams, useSearchParams } from 'react-router-dom';
import { useNavGestures } from '../../../os/navigation';
import { routes } from '../routes';

/**
 * A dialog of a settings page kept in the URL (/page/:pageId?dialog=<name>&...):
 * system back closes it, as on a phone. `extra` carries what the dialog is about
 * (the network being joined, the preference being edited).
 */
export function usePageDialog(name: 'ssid' | 'password' | 'connect' | 'btName' | 'value' | 'list') {
  const { pageId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { bindNav, bindBack, bindTap, nav } = useNavGestures();
  return {
    isOpen: (extra?: Record<string, string>) =>
      searchParams.get('dialog') === name && Object.entries(extra ?? {}).every(([k, v]) => searchParams.get(k) === v),
    param: (key: string) => searchParams.get(key) ?? '',
    bindOpen: (extra?: Record<string, string>) => bindNav(routes.page, { params: { pageId }, search: { dialog: name, ...extra } }),
    open: (extra?: Record<string, string>) => nav.push(routes.page, { pageId }, { search: { dialog: name, ...extra } }),
    /** Another dialog in its place (SSID, then password): back from it returns to the page. */
    replaceWith: (next: 'password', extra?: Record<string, string>) =>
      nav.replace(routes.page, { pageId }, { search: { dialog: next, ...extra } }),
    cancelBind: bindBack(),
    bindTap,
    close: () => nav.back(),
  };
}
