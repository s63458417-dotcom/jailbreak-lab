import * as idb from 'idb-keyval';

// Wrapper for robust persistence
// Prevents the "revert to original" issue by using IndexedDB instead of localStorage
// We use 'import * as idb' to ensure compatibility with different build systems

export const db = {
  get: async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
      const val = await idb.get(key);
      return val === undefined ? defaultValue : val;
    } catch (err) {
      console.error(`DB Load Error [${key}]:`, err);
      return defaultValue;
    }
  },

  set: async (key: string, value: any): Promise<void> => {
    try {
      await idb.set(key, value);
    } catch (err) {
      console.error(`DB Save Error [${key}]:`, err);
    }
  },

  delete: async (key: string): Promise<void> => {
    try {
      await idb.del(key);
    } catch (err) {
      console.error(`DB Delete Error [${key}]:`, err);
    }
  }
};