import { get, set, del } from 'idb-keyval';

// Wrapper for robust persistence
// Prevents the "revert to original" issue by using IndexedDB instead of localStorage

export const db = {
  get: async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
      const val = await get(key);
      return val === undefined ? defaultValue : val;
    } catch (err) {
      console.error(`DB Load Error [${key}]:`, err);
      return defaultValue;
    }
  },

  set: async (key: string, value: any): Promise<void> => {
    try {
      await set(key, value);
    } catch (err) {
      console.error(`DB Save Error [${key}]:`, err);
    }
  },

  delete: async (key: string): Promise<void> => {
    try {
      await del(key);
    } catch (err) {
      console.error(`DB Delete Error [${key}]:`, err);
    }
  }
};
