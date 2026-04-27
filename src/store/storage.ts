import { createStore, get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

const DB_NAME = "taskflow";
const STORE_NAME = "state";
const idbStore = createStore(DB_NAME, STORE_NAME);

let writeFailureNotified = false;
function notifyWriteFailure(err: unknown) {
  if (writeFailureNotified) return;
  writeFailureNotified = true;
  // eslint-disable-next-line no-console
  console.error(
    "[taskflow] Failed to persist state. Changes won't survive a reload.",
    err,
  );
}

/**
 * IndexedDB-backed storage for Zustand's persist middleware.
 *
 * On first read we copy an existing localStorage payload into IDB so users
 * who used the earlier localStorage-only build keep their data.
 */
export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      const fromIdb = await get<string>(name, idbStore);
      if (fromIdb != null) return fromIdb;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[taskflow] IDB read failed, falling back to localStorage", err);
    }

    try {
      const legacy = typeof localStorage !== "undefined" ? localStorage.getItem(name) : null;
      if (legacy != null) {
        try {
          await set(name, legacy, idbStore);
          localStorage.removeItem(name);
        } catch {
          // Migration to IDB failed — keep the legacy value in localStorage.
        }
        return legacy;
      }
    } catch {
      // localStorage can throw in private mode; ignore.
    }
    return null;
  },
  async setItem(name, value) {
    try {
      await set(name, value, idbStore);
    } catch (err) {
      notifyWriteFailure(err);
    }
  },
  async removeItem(name) {
    try {
      await del(name, idbStore);
    } catch (err) {
      notifyWriteFailure(err);
    }
  },
};
