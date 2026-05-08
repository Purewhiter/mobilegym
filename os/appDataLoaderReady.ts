export type AppDataLoaderModule = {
  preload?: () => Promise<any>;
  hydrateStore?: () => Promise<any>;
  waitReady?: () => Promise<any>;
};

export async function runAppDataLoaderModule(mod: AppDataLoaderModule): Promise<void> {
  if (typeof mod.preload === 'function') await mod.preload();
  if (typeof mod.hydrateStore === 'function') await mod.hydrateStore();
  if (typeof mod.waitReady === 'function') await mod.waitReady();
}
