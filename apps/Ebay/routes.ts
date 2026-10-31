import { defineRoutes } from '../../os/navigation/routes';

/** Ebay's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  me: { path: '/me' },
  search: { path: '/search' },
  sell: { path: '/sell' },
  inbox: { path: '/inbox' },
  cart: { path: '/cart' },
  categories: { path: '/categories' },
  settings: { path: '/settings' },
  item: { path: '/item/:id' },
});
