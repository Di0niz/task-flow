import { createStore, get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

const DB_NAME = "taskflow";
const STORE_NAME = "state";
const idbStore = createStore(DB_NAME, STORE_NAME);

/**
 * IndexedDB-backed storage for Zustand's persist middleware.
 *
 * On first read we copy an existing localStorage payload into IDB so users
 * who used the earlier localStorage-only build keep their data.
 */
export const idbStorage: StateStorage = {
  async getItem(name) {
    const fromIdb = await get<string>(name, idbStore);
    if (fromIdb != null) return fromIdb;

    try {
      const legacy = typeof localStorage !== "undefined" ? localStorage.getItem(name) : null;
      if (legacy != null) {
        await set(name, legacy, idbStore);
        localStorage.removeItem(name);
        return legacy;
      }
    } catch {
      // localStorage can throw in private mode; ignore.
    }
    return null;
  },
  async setItem(name, value) {
    await set(name, value, idbStore);
  },
  async removeItem(name) {
    await del(name, idbStore);
  },
};
