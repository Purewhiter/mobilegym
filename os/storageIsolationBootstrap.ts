import { installLocalStorageNamespacing } from './storageIsolation';

// Install as early as possible (import this module at the very top of entry).
// This makes all existing localStorage usages automatically namespaced.
const installed = installLocalStorageNamespacing();

// Expose for debugging / automation scripts.
window.__STORAGE_ISOLATION__ = installed;
