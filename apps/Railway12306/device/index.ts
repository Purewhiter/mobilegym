/**
 * Railway12306 on the device server.
 *
 * Only the offline train catalog (data/catalog/trainCatalog.json, ~24MB) lives
 * here: loaded and indexed once per server process instead of once per page
 * that searches for trains. The queries take the page's simulated clock
 * (today's departures already gone, presale window), so results match what
 * the page computed before.
 *
 * The app's own state (orders, passengers, account) still lives in the page
 * store; this module keeps no session state.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppModule, Catalog } from '../../../device/engine';
import { createTrainCatalog, type CatalogClock, type CatalogJson, type TrainCatalog } from '../services/catalogService';

const trainCatalog = (catalog: Catalog) => catalog.extras.trains as TrainCatalog;

function clockArg(args: Record<string, unknown>): CatalogClock {
  const today = String(args.today ?? '');
  const nowHHmm = String(args.nowHHmm ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !/^\d{2}:\d{2}$/.test(nowHHmm)) {
    throw new Error('railway12306 catalog queries need today (YYYY-MM-DD) and nowHHmm (HH:mm)');
  }
  return { today, nowHHmm };
}

export function createRailway12306Module(): AppModule<Record<string, never>> {
  return {
    appId: 'railway12306',
    loadCatalog(root) {
      const json = JSON.parse(
        readFileSync(join(root, 'apps', 'Railway12306', 'data', 'catalog', 'trainCatalog.json'), 'utf8'),
      ) as CatalogJson;
      return { collections: new Map(), extras: { trains: createTrainCatalog(json) } };
    },
    materialize() {},
    exportState: () => ({}),
    importState: () => ({}),
    defaultState: () => ({}),
    commands: {},
    queries: {
      /** Direct trains; `null` = the catalog does not cover this OD (page falls back to the live API). */
      directTrains(ctx, args) {
        return trainCatalog(ctx.catalog).queryDirect(
          String(args.from ?? ''), String(args.to ?? ''), String(args.date ?? ''), clockArg(args),
        );
      },
      /** Stop list by internal train number; `null` = train not in the catalog. */
      trainStops(ctx, args) {
        return trainCatalog(ctx.catalog).trainStops(String(args.trainNo ?? ''));
      },
      /** Transfer plans; `null` = not covered. */
      transferPlans(ctx, args) {
        return trainCatalog(ctx.catalog).queryTransfer(
          String(args.from ?? ''), String(args.to ?? ''), String(args.date ?? ''), clockArg(args),
        );
      },
    },
  };
}
