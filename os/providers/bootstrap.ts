import { ensureContactsProviderRegistered } from './ContactsProvider';
import { ensureMediaProviderRegistered } from './MediaProvider';
import { ensureSmsProviderRegistered } from './SmsProvider';

export function ensureOsProvidersRegistered(): void {
  ensureContactsProviderRegistered();
  ensureMediaProviderRegistered();
  ensureSmsProviderRegistered();
}

ensureOsProvidersRegistered();
