import { defineRoutes } from '../../os/navigation/routes';

/** Contacts's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'dialpad': ['true'] } },
  contacts: { path: '/contacts', search: { 'fav': ['true'] } },
  business: { path: '/business' },
  search: { path: '/search' },
  contact: { path: '/contact/:contactId' },
  call: { path: '/call/:callLogId' },
  contactsNew: { path: '/contacts/new' },
  settingsCalls: { path: '/settings/calls' },
  settingsContacts: { path: '/settings/contacts' },
  settingsPage: { path: '/settings/page/:pageId' },
});
