import type { MapMetadata, SavedMap } from '@/services/mapLibrary';
import type { SceneConfig } from '@/types/scene';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Brief model info returned by the list endpoint. */
export interface MapModel {
  id: string;
  name: string;
  description: string;
  modelPath: string;
  thumbnail: string;
  configPath: string;
  createdAt: string;
  updatedAt: string;
}

/** Full model detail including the complete scene config and metadata. */
export interface MapModelDetail extends MapModel {
  config: SceneConfig;
  metadata: MapMetadata;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

const API_BASE = '/api/models';

async function handleResponse<T>(response: Response, errorLabel: string): Promise<T> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${errorLabel}: 服务器返回格式错误`);
  }

  if (!response.ok) {
    throw new Error((body.message as string) || `${errorLabel}: 请求失败 (${response.status})`);
  }

  // Backend wraps all responses in { data: ..., message, status } envelope.
  // Unwrap so callers get the actual payload directly.
  const payload = 'data' in body ? body.data : body;
  return payload as T;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Upload a model file (GLB/GLTF) together with an optional thumbnail.
 *
 * POST /api/models/upload  (multipart/form-data)
 *
 * @param file       - The GLB/GLTF model file.
 * @param name       - Optional human-readable map name.
 * @param description- Optional map description.
 * @param thumbnail  - Optional thumbnail image file.
 * @param id         - Optional map ID.  Pass when re‑uploading a base map
 *                     for an existing map so the backend can overwrite the
 *                     old model file at {@code uploads/models/{id}.glb}
 *                     instead of creating a new UUID‑based file.
 */
export async function uploadModel(
  file: File,
  name?: string,
  description?: string,
  thumbnail?: File,
  id?: string,
): Promise<MapModelDetail> {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  if (description) formData.append('description', description);
  if (thumbnail) formData.append('thumbnail', thumbnail);
  if (id) formData.append('id', id);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  const result = await handleResponse<MapModelDetail[] | MapModelDetail>(response, '上传模型');
  // Backend returns data as [MapModelDetail] even for single upload
  if (Array.isArray(result)) {
    return result[0];
  }
  return result;
}

/**
 * Fetch the list of all saved models.
 *
 * GET /api/models
 */
export async function fetchModelList(): Promise<MapModel[]> {
  const response = await fetch(API_BASE);
  const result = await handleResponse<MapModel[] | { models: MapModel[] }>(response, '获取模型列表');
  if (Array.isArray(result)) {
    return result;
  }
  return result.models ?? [];
}

/**
 * Fetch the full detail of one model, including its scene config.
 *
 * GET /api/models/:id
 */
export async function fetchModelDetail(id: string): Promise<MapModelDetail> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
  return handleResponse<MapModelDetail>(response, '获取模型详情');
}

/**
 * Save / update a model's configuration (name, description, scene config, metadata).
 *
 * PUT /api/models/:id/config
 */
export async function saveModelConfig(
  id: string,
  data: {
    name: string;
    description: string;
    config: SceneConfig;
    metadata: MapMetadata;
    thumbnail?: string;
  },
): Promise<void> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  await handleResponse<{ success: boolean }>(response, '保存配置');
}

/**
 * Upload a thumbnail image and return the accessible URL.
 *
 * POST /api/models/thumbnail  (multipart/form-data)
 */
export async function uploadThumbnail(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/thumbnail`, {
    method: 'POST',
    body: formData,
  });

  const result = await handleResponse<{ path: string }>(response, '上传缩略图');
  return result.path;
}

/**
 * Delete a model and all its associated files (glb, config json, thumbnail).
 *
 * DELETE /api/models/:id
 */
export async function deleteModel(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  await handleResponse<{ success: boolean }>(response, '删除模型');
}
