import ContentProvider from '../ContentProvider';
import ContentResolver from '../ContentResolver';
import { createOsStore } from '../createOsStore';
import * as TimeService from '../TimeService';
import type { ContentUri, ContentValues, Cursor } from '../types/content';
import type { Contact, ContactEmail, ContactPhone } from '../../system/Contacts/types';
import contactsDefaults from './defaults/contacts.json';

export interface ContactsProviderState {
  contacts: Contact[];
}

function normalizeDigits(input: string): string {
  return String(input ?? '').replace(/\D+/g, '');
}

function pickProjection<T extends Record<string, any>>(item: T, projection?: string[]): Record<string, any> {
  if (!projection || projection.length === 0) return item;
  const out: Record<string, any> = {};
  for (const key of projection) {
    if (key in item) out[key] = item[key];
  }
  return out;
}

function asPhones(v: any): ContactPhone[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : '',
      label: typeof x.label === 'string' ? x.label : '手机',
      number: typeof x.number === 'string' ? x.number : '',
      isPrimary: Boolean(x.isPrimary),
    }))
    .filter((x) => x.number.trim().length > 0);
}

function asEmails(v: any): ContactEmail[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : '',
      label: typeof x.label === 'string' ? x.label : '邮箱',
      email: typeof x.email === 'string' ? x.email : '',
      isPrimary: Boolean(x.isPrimary),
    }))
    .filter((x) => x.email.trim().length > 0);
}

const randomId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${TimeService.now().toString(36).slice(-4)}`;

function normalizePhoneId(phones: ContactPhone[]) {
  return phones.map((p) => ({ ...p, id: p.id || randomId('phone') }));
}

function normalizeEmailId(emails: ContactEmail[] | undefined) {
  return (emails ?? []).map((e) => ({ ...e, id: e.id || randomId('email') }));
}

const defaultState: ContactsProviderState = {
  contacts: structuredClone(contactsDefaults.contacts) as Contact[],
};

export const useContactsProviderStore = createOsStore<ContactsProviderState>(
  'provider.contacts',
  defaultState,
  {
    persistName: 'provider_contacts',
    registerToServiceRegistry: false,
    registerToProviderRegistry: true,
  },
);

export class ContactsProvider extends ContentProvider {
  query(uri: ContentUri, projection?: string[]): Cursor<any> {
    const parsed = ContentResolver.parseUri(uri);
    const path = parsed.path;
    const contacts = useContactsProviderStore.getState().contacts;

    if (path === '/contacts' || path === '/contacts/') {
      const phoneQuery = parsed.query.get('phone');
      if (phoneQuery) {
        const q = normalizeDigits(phoneQuery);
        const matched = contacts.filter((c) =>
          (c.phones ?? []).some((p) => normalizeDigits(p.number).includes(q)),
        );
        return { items: matched.map((x) => pickProjection(x as any, projection)), count: matched.length };
      }
      return { items: contacts.map((x) => pickProjection(x as any, projection)), count: contacts.length };
    }

    if (path === '/contacts/starred') {
      const starred = contacts.filter((c) => Boolean(c.starred));
      return { items: starred.map((x) => pickProjection(x as any, projection)), count: starred.length };
    }

    if (path === '/contacts/search') {
      const qRaw = String(parsed.query.get('q') ?? '').trim().toLowerCase();
      if (!qRaw) return { items: [], count: 0 };
      const qDigits = normalizeDigits(qRaw);
      const matched = contacts.filter((c) => {
        const nameHit = c.displayName.toLowerCase().includes(qRaw);
        const phoneHit = qDigits
          ? (c.phones ?? []).some((p) => normalizeDigits(p.number).includes(qDigits))
          : false;
        const emailHit = (c.emails ?? []).some((e) => e.email.toLowerCase().includes(qRaw));
        return nameHit || phoneHit || emailHit;
      });
      return { items: matched.map((x) => pickProjection(x as any, projection)), count: matched.length };
    }

    const single = path.match(/^\/contacts\/([^/]+)$/);
    if (single) {
      const contact = contacts.find((c) => c.id === single[1]);
      if (!contact) return { items: [], count: 0 };
      return { items: [pickProjection(contact as any, projection)], count: 1 };
    }

    return { items: [], count: 0 };
  }

  insert(uri: ContentUri, values: ContentValues): ContentUri {
    const parsed = ContentResolver.parseUri(uri);
    if (!(parsed.path === '/contacts' || parsed.path === '/contacts/')) {
      throw new Error(`[ContactsProvider] Unsupported insert URI: ${parsed.path}`);
    }
    const displayName = String(values.displayName ?? values.name ?? '').trim() || '未命名';
    const phones = asPhones(values.phones);
    if (phones.length === 0 && typeof values.phone === 'string') {
      phones.push({ id: '', label: '手机', number: String(values.phone), isPrimary: true });
    }
    const emails = asEmails(values.emails);
    const now = TimeService.now();
    const id = typeof values.id === 'string' && values.id.trim() ? values.id.trim() : randomId('c');
    const next: Contact = {
      displayName,
      id,
      sortKey: typeof values.sortKey === 'string' ? values.sortKey : undefined,
      sectionKey: typeof values.sectionKey === 'string' ? values.sectionKey : undefined,
      avatarColor: typeof values.avatarColor === 'string' ? values.avatarColor : undefined,
      avatarUri: typeof values.avatarUri === 'string' ? values.avatarUri : undefined,
      starred: Boolean(values.starred),
      lastContactedAt: typeof values.lastContactedAt === 'number' ? values.lastContactedAt : undefined,
      phones: normalizePhoneId(phones),
      emails: normalizeEmailId(emails),
      company: typeof values.company === 'string' ? values.company : undefined,
      title: typeof values.title === 'string' ? values.title : undefined,
      notes: typeof values.notes === 'string' ? values.notes : undefined,
      createdAt: typeof values.createdAt === 'number' ? values.createdAt : now,
      updatedAt: typeof values.updatedAt === 'number' ? values.updatedAt : now,
    };
    (useContactsProviderStore.setState as any)((state: ContactsProviderState) => {
      state.contacts.unshift(next);
    });
    return `content://contacts/contacts/${id}`;
  }

  update(uri: ContentUri, values: ContentValues, _where?: string): number {
    const parsed = ContentResolver.parseUri(uri);
    const single = parsed.path.match(/^\/contacts\/([^/]+)$/);
    if (!single) return 0;
    const id = single[1];
    const contacts = useContactsProviderStore.getState().contacts;
    if (!contacts.some((c) => c.id === id)) return 0;
    const patch: Partial<Omit<Contact, 'id'>> = {};
    if ('displayName' in values) patch.displayName = String(values.displayName ?? '');
    if ('sortKey' in values) patch.sortKey = typeof values.sortKey === 'string' ? values.sortKey : undefined;
    if ('sectionKey' in values) patch.sectionKey = typeof values.sectionKey === 'string' ? values.sectionKey : undefined;
    if ('avatarColor' in values) patch.avatarColor = typeof values.avatarColor === 'string' ? values.avatarColor : undefined;
    if ('avatarUri' in values) patch.avatarUri = typeof values.avatarUri === 'string' ? values.avatarUri : undefined;
    if ('starred' in values) patch.starred = Boolean(values.starred);
    if ('phones' in values) patch.phones = normalizePhoneId(asPhones(values.phones));
    if ('emails' in values) patch.emails = normalizeEmailId(asEmails(values.emails));
    if ('company' in values) patch.company = typeof values.company === 'string' ? values.company : undefined;
    if ('title' in values) patch.title = typeof values.title === 'string' ? values.title : undefined;
    if ('notes' in values) patch.notes = typeof values.notes === 'string' ? values.notes : undefined;
    if ('lastContactedAt' in values) {
      patch.lastContactedAt = typeof values.lastContactedAt === 'number' ? values.lastContactedAt : undefined;
    }
    patch.updatedAt = typeof values.updatedAt === 'number' ? values.updatedAt : TimeService.now();
    (useContactsProviderStore.setState as any)((state: ContactsProviderState) => {
      state.contacts = state.contacts.map((contact) => (
        contact.id === id ? { ...contact, ...patch } : contact
      ));
    });
    return 1;
  }

  delete(uri: ContentUri, _where?: string): number {
    const parsed = ContentResolver.parseUri(uri);
    const single = parsed.path.match(/^\/contacts\/([^/]+)$/);
    if (!single) return 0;
    const id = single[1];
    const contacts = useContactsProviderStore.getState().contacts;
    if (!contacts.some((c) => c.id === id)) return 0;
    (useContactsProviderStore.setState as any)((state: ContactsProviderState) => {
      state.contacts = state.contacts.filter((contact) => contact.id !== id);
    });
    return 1;
  }

  getType(uri: ContentUri): string {
    const parsed = ContentResolver.parseUri(uri);
    if (parsed.path.match(/^\/contacts\/[^/]+$/)) return 'vnd.android.cursor.item/contact';
    return 'vnd.android.cursor.dir/contact';
  }
}

let contactsProvider: ContactsProvider | null = null;

export function ensureContactsProviderRegistered(): void {
  if (!contactsProvider) {
    contactsProvider = new ContactsProvider();
  }
  ContentResolver.registerProvider('contacts', contactsProvider);
}

export default ContactsProvider;
