const DATABASE_NAME = 'twintrack-modeling-assets';
const DATABASE_VERSION = 1;
const STORE_NAME = 'files';

const objectUrls = new Map<string, string>();
const pendingObjectUrls = new Map<string, Promise<string | null>>();
let databasePromise: Promise<IDBDatabase> | null = null;

interface CachedModelFile {
  id: string;
  name: string;
  type: string;
  file: Blob;
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地模型缓存'));
  });
  return databasePromise;
}

export async function saveModelingAsset(id: string, file: File): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      id,
      name: file.name,
      type: file.type || 'model/gltf-binary',
      file,
      updatedAt: new Date().toISOString(),
    } satisfies CachedModelFile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('无法缓存模型文件'));
    transaction.onabort = () => reject(transaction.error || new Error('模型缓存已取消'));
  });
  const previousUrl = objectUrls.get(id);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  objectUrls.delete(id);
}

export async function getModelingAssetUrl(id: string): Promise<string | null> {
  const existingUrl = objectUrls.get(id);
  if (existingUrl) return existingUrl;
  const pending = pendingObjectUrls.get(id);
  if (pending) return pending;
  const promise = (async () => {
    const database = await openDatabase();
    const record = await new Promise<CachedModelFile | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as CachedModelFile | undefined);
      request.onerror = () => reject(request.error || new Error('无法读取本地模型缓存'));
    });
    if (!record?.file) return null;
    const url = URL.createObjectURL(record.file);
    objectUrls.set(id, url);
    return url;
  })();
  pendingObjectUrls.set(id, promise);
  try {
    return await promise;
  } finally {
    pendingObjectUrls.delete(id);
  }
}

export async function deleteModelingAsset(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('无法删除本地模型文件'));
    transaction.onabort = () => reject(transaction.error || new Error('删除模型缓存已取消'));
  });
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

export function modelingAssetPath(id: string): string {
  return `modeling-asset://${encodeURIComponent(id)}`;
}

export function modelingAssetIdFromPath(path: string): string | null {
  const prefix = 'modeling-asset://';
  if (!path.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(path.slice(prefix.length));
  } catch {
    return null;
  }
}
