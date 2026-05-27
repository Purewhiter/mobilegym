import { ensureContactsProviderRegistered } from './ContactsProvider';
import { ensureMediaProviderRegistered } from './MediaProvider';
import { ensureSmsProviderRegistered } from './SmsProvider';
import { ensureSystemWidgetProviderRegistered } from './SystemWidgetProvider';
// Side-effect: eagerly loads apps/<app>/providers/*.ts and
// system/<app>/providers/*.ts. Must come AFTER ContactsProvider et al so
// that ContentResolver is fully initialized when the glob fires (otherwise
// app providers hit TDZ trying to call ContentResolver.registerProvider at
// module body). See appProvidersBootstrap.ts for the full rationale.
import './appProvidersBootstrap';

export function ensureOsProvidersRegistered(): void {
  ensureContactsProviderRegistered();
  ensureMediaProviderRegistered();
  ensureSmsProviderRegistered();
  ensureSystemWidgetProviderRegistered();
}

ensureOsProvidersRegistered();
