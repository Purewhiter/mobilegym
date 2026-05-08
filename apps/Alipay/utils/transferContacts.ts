import type { AlipayTransferRecord } from '../types';

type ContactLike = {
  id: string | number;
  name: string;
  phone?: string;
  account?: string;
  info?: string;
};

const TRANSFER_PREFIX = /^转账-/;
const RED_PACKET_PREFIX = /^转账红包-/;

function normalize(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function addNameAliases(target: Set<string>, rawValue?: string) {
  const value = String(rawValue || '').trim();
  if (!value) return;

  const plainValue = value.replace(TRANSFER_PREFIX, '').trim();
  const bracketMatch = plainValue.match(/\(([^)]+)\)/);
  const displayName = plainValue.replace(/\([^)]*\)/g, '').trim();

  [value, plainValue, displayName, bracketMatch?.[1] || '']
    .map(normalize)
    .filter(Boolean)
    .forEach(alias => target.add(alias));
}

function buildContactAliasSet(contact: ContactLike) {
  const aliases = new Set<string>();

  addNameAliases(aliases, contact.name);
  addNameAliases(aliases, contact.info);

  [contact.phone, contact.account]
    .map(value => normalize(String(value || '')))
    .filter(Boolean)
    .forEach(alias => aliases.add(alias));

  return aliases;
}

function buildRecordAliasSet(record: AlipayTransferRecord) {
  const aliases = new Set<string>();

  addNameAliases(aliases, record.targetAccount);
  addNameAliases(aliases, record.displayTitle);
  addNameAliases(aliases, record.counterpartyName);

  return aliases;
}

function isTransferContactRecord(record: AlipayTransferRecord) {
  const counterpartyName = String(record.counterpartyName || '').trim();
  if (RED_PACKET_PREFIX.test(counterpartyName)) return false;
  return Boolean(record.targetAccount) || record.kind === 'transfer' || TRANSFER_PREFIX.test(counterpartyName);
}

function matchTransferRecordToContact<T extends ContactLike>(record: AlipayTransferRecord, contacts: T[]) {
  const recordAliases = buildRecordAliasSet(record);
  if (recordAliases.size === 0) return null;

  return contacts.find((contact) => {
    const contactAliases = buildContactAliasSet(contact);
    return Array.from(recordAliases).some(alias => contactAliases.has(alias));
  }) || null;
}

export function getRecentTransferContacts<T extends ContactLike>(
  contacts: T[],
  transferRecords: AlipayTransferRecord[],
  limit = contacts.length,
) {
  const seen = new Set<string>();
  const matchedContacts: T[] = [];

  const sortedRecords = [...transferRecords]
    .filter(isTransferContactRecord)
    .sort((a, b) => b.timestamp - a.timestamp);

  for (const record of sortedRecords) {
    const contact = matchTransferRecordToContact(record, contacts);
    if (!contact) continue;

    const contactId = String(contact.id);
    if (seen.has(contactId)) continue;

    seen.add(contactId);
    matchedContacts.push(contact);

    if (matchedContacts.length >= limit) break;
  }

  return matchedContacts;
}

export function sortContactsByName<T extends ContactLike>(contacts: T[]) {
  return [...contacts].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}
