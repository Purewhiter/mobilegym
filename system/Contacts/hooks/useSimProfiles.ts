import React from 'react';
import { CONTACTS_CONFIG } from '../data';
import { getOsDataRevision, subscribeOsDataRevision } from '../../../os/simState';
import { getEffectiveTelephony } from '../../../os/managers/registry';
import type { SimProfile } from '../phoneTypes';

function normalizeDeviceSimsToProfiles(
  sims: Array<{ slot: 1 | 2; carrier: string; phoneNumber: string }>,
): SimProfile[] {
  const mapped = sims
    .map((sim) => ({
      slot: sim.slot === 2 ? 2 : 1,
      label: sim.carrier || `卡${sim.slot === 2 ? 2 : 1}`,
      numberMasked: sim.phoneNumber || '未设置',
    }))
    .sort((a, b) => a.slot - b.slot) as SimProfile[];

  return mapped.length ? mapped : [...CONTACTS_CONFIG.sims];
}

export function useSimProfiles(): SimProfile[] {
  const osDataRevision = React.useSyncExternalStore(
    subscribeOsDataRevision,
    getOsDataRevision,
  );
  const telephony = getEffectiveTelephony();
  return React.useMemo(
    () => normalizeDeviceSimsToProfiles(telephony.sims || []),
    [osDataRevision, telephony.sims],
  );
}
