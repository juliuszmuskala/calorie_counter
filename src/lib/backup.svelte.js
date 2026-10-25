// Automatic backup to a file on disk (File System Access API, Chromium browsers), plus the data the backup reminder needs.
import { db, backupJson, backupMeta, markBackup } from './store.svelte.js';

const DB_NAME = 'calorie-counter-backup';
const HANDLE_KEY = 'file';
const SNOOZE_KEY = 'calorie-counter:backupSnooze';
const STALE_MS = 7 * 86400000;

export const backup = $state({
  supported: typeof window !== 'undefined' && 'showSaveFilePicker' in window,
  fileName: '', // linked backup file
  needsPermission: false, // linked, but the browser wants a click before it allows writing again
  error: '',
  snoozeUntil: 0,
});

try {
  backup.snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY)) || 0;
} catch {}

let handle = null;

// the file handle can't go in localStorage, IndexedDB can store it
const idb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function idbRun(mode, fn) {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('handles', mode);
    const req = fn(tx.objectStore('handles'));
    tx.oncomplete = () => (d.close(), resolve(req.result));
    tx.onerror = () => (d.close(), reject(tx.error));
  });
}

async function permission(request) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return request && (await handle.requestPermission(opts)) === 'granted';
}

async function write() {
  const w = await handle.createWritable();
  try {
    await w.write(backupJson());
  } finally {
    await w.close();
  }
  markBackup();
  backup.error = '';
}

async function loadHandle() {
  if (!backup.supported) return;
  try {
    handle = (await idbRun('readonly', (s) => s.get(HANDLE_KEY))) ?? null;
    if (!handle) return;
    backup.fileName = handle.name;
    backup.needsPermission = !(await permission(false));
  } catch {
    handle = null;
  }
}

// Pick (or create) the backup file. Must be called from a click.
export async function linkBackupFile() {
  try {
    const picked = await showSaveFilePicker({
      suggestedName: 'calorie-counter-backup.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    handle = picked;
    await idbRun('readwrite', (s) => s.put(picked, HANDLE_KEY));
    backup.fileName = picked.name;
    backup.needsPermission = false;
    await write();
  } catch (err) {
    if (err.name !== 'AbortError') backup.error = `Could not set up the backup file: ${err.message}`;
  }
}

export async function unlinkBackupFile() {
  handle = null;
  backup.fileName = '';
  backup.needsPermission = false;
  backup.error = '';
  try {
    await idbRun('readwrite', (s) => s.delete(HANDLE_KEY));
  } catch {}
}

// Click handler for "allow" after a reload; also writes right away.
export async function resumeBackup() {
  if (!handle) return;
  try {
    if (await permission(true)) {
      backup.needsPermission = false;
      await write();
    }
  } catch (err) {
    backup.error = `Backup failed: ${err.message}`;
  }
}

export function snoozeReminder() {
  backup.snoozeUntil = Date.now() + 86400000;
  try {
    localStorage.setItem(SNOOZE_KEY, String(backup.snoozeUntil));
  } catch {}
}

export const daysSinceBackup = () => (backupMeta.last ? Math.floor((Date.now() - backupMeta.last) / 86400000) : null);

// Whether to nag: there is data, nothing is keeping it safe automatically, and the last backup is old or missing.
export const reminderDue = () =>
  db.entries.length > 0 &&
  !backup.fileName &&
  Date.now() > backup.snoozeUntil &&
  (!backupMeta.last || Date.now() - backupMeta.last > STALE_MS);

// Starts writing the backup file shortly after each change. Returns a cleanup function.
export function startAutoBackup() {
  loadHandle();
  let timer;
  let busy = false;
  const stop = $effect.root(() => {
    $effect(() => {
      JSON.stringify($state.snapshot(db)); // track every change
      clearTimeout(timer);
      if (!handle) return;
      timer = setTimeout(async () => {
        if (busy || !handle) return;
        busy = true;
        try {
          if (await permission(false)) await write();
          else backup.needsPermission = true;
        } catch (err) {
          backup.error = `Backup failed: ${err.message}`;
        } finally {
          busy = false;
        }
      }, 3000);
    });
  });
  return () => {
    stop();
    clearTimeout(timer);
  };
}
