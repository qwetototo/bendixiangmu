const DEVICE_ASSIGNMENTS_UPDATED_EVENT = 'twintrack:device-assignments-updated';
const DEVICE_ASSIGNMENTS_UPDATED_STORAGE_KEY = 'twintrack:device-assignments-updated-at';

/** Notify the current tab and other same-origin tabs after device assignments change. */
export function notifyDeviceAssignmentsUpdated(): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new Event(DEVICE_ASSIGNMENTS_UPDATED_EVENT));
  try {
    window.localStorage.setItem(DEVICE_ASSIGNMENTS_UPDATED_STORAGE_KEY, String(Date.now()));
  } catch {
    // The same-tab event still works when browser storage is unavailable.
  }
}

/** Subscribe to device assignment changes from this tab or another same-origin tab. */
export function onDeviceAssignmentsUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === DEVICE_ASSIGNMENTS_UPDATED_STORAGE_KEY) callback();
  };

  window.addEventListener(DEVICE_ASSIGNMENTS_UPDATED_EVENT, callback);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(DEVICE_ASSIGNMENTS_UPDATED_EVENT, callback);
    window.removeEventListener('storage', handleStorage);
  };
}
