import floorConfig from '@/assets/config/config.json';
import type { ModelConfig, Point3D, SceneConfig } from '@/types/scene';
import { toRaw } from 'vue';

export interface MapFloorItem {
  id: string;
  name: string;
  description?: string;
  config: SceneConfig;
}

export interface MapMetadata {
  thumbnail: string;
  region: string;
  address: string;
  mapOrigin: Point3D;
  positioningOrigin: Point3D;
  scaleRatio: number;
  modelParameters: ModelConfig[];
  activeFloorId: string;
  floors: MapFloorItem[];
}

export interface SavedMap {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  config: SceneConfig;
  metadata: MapMetadata;
}

const MAP_LIBRARY_STORAGE_KEY = 'twintrack.mapLibrary';
const ACTIVE_MAP_STORAGE_KEY = 'twintrack.activeMapId';
export const DEFAULT_MAP_ID = 'default-office-floor';

export function cloneSceneConfig(config: SceneConfig): SceneConfig {
  return JSON.parse(JSON.stringify(toRaw(config))) as SceneConfig;
}

/** 归一化模型配置：修复旧数据中 2 元素 center / heightOffset 的遗留格式。 */
export function normalizeModelConfig(model: ModelConfig): ModelConfig {
  const legacyCenter = model.center as unknown as number[];
  const legacyHeight = Number((model as { heightOffset?: unknown }).heightOffset);
  const center: [number, number, number] =
    legacyCenter.length > 2
      ? [Number(legacyCenter[0]) || 0, Number(legacyCenter[1]) || 0, Number(legacyCenter[2]) || 0]
      : [Number(legacyCenter[0]) || 0, Number.isFinite(legacyHeight) ? legacyHeight : 0, Number(legacyCenter[1]) || 0];

  return {
    path: model.path,
    scale: model.scale,
    center,
    rotation: [...model.rotation] as [number, number, number],
    role: model.role,
  };
}

export function cloneModels(models: ModelConfig[]): ModelConfig[] {
  return models.map((model) => normalizeModelConfig(model));
}

export function applySharedModelParameters(models: ModelConfig[], parameters: ModelConfig[]): ModelConfig[] {
  const roleOffsets = new Map<string, number>();
  return cloneModels(models).map((model, index) => {
    const role = model.role || `index-${index}`;
    const roleOffset = roleOffsets.get(role) ?? 0;
    roleOffsets.set(role, roleOffset + 1);
    const roleMatches = parameters.filter((parameter) => parameter.role === model.role);
    const parameter = roleMatches[roleOffset] ?? parameters[index];
    if (!parameter) return model;
    return {
      ...model,
      path: model.path,
      scale: parameter.scale,
      center: [...parameter.center] as [number, number, number],
      rotation: [...parameter.rotation] as [number, number, number],
    };
  });
}

function normalizePoint3D(value: unknown, fallback: Point3D): Point3D {
  if (!Array.isArray(value)) {
    return [...fallback] as Point3D;
  }

  return [0, 1, 2].map((index) => {
    const numericValue = Number(value[index]);
    return Number.isFinite(numericValue) ? numericValue : fallback[index];
  }) as Point3D;
}

export function createDefaultMetadata(config: SceneConfig, metadata?: Partial<MapMetadata>): MapMetadata {
  const mapOrigin: Point3D = normalizePoint3D(metadata?.mapOrigin, [0, 0, 0]);
  const positioningOrigin = normalizePoint3D(metadata?.positioningOrigin, mapOrigin);
  const metadataScaleRatio = Number(metadata?.scaleRatio);
  const configScaleRatio = Number(config.floor.scale);
  const scaleRatio =
    Number.isFinite(metadataScaleRatio) && metadataScaleRatio > 0
      ? metadataScaleRatio
      : Number.isFinite(configScaleRatio) && configScaleRatio > 1
        ? configScaleRatio
        : 100;
  const fallbackFloor: MapFloorItem = {
    id: config.floor.id || `floor-${Date.now()}`,
    name: config.floor.name || '1F',
    config: cloneSceneConfig(config),
  };
  const floors = Array.isArray(metadata?.floors)
    ? metadata.floors
        .filter((floor) => floor && typeof floor.id === 'string' && isSceneConfig(floor.config))
        .map((floor) => ({
          id: floor.id,
          name: floor.name || floor.config.floor.name || floor.id,
          description: typeof floor.description === 'string' ? floor.description : '',
          config: cloneSceneConfig(floor.config),
        }))
    : [];
  const normalizedFloors = floors.length > 0 ? floors : [fallbackFloor];
  const legacyMetadata = metadata as Partial<MapMetadata> & { models?: ModelConfig[] } | undefined;
  const metadataParameters = Array.isArray(metadata?.modelParameters)
    ? metadata.modelParameters
    : Array.isArray(legacyMetadata?.models)
      ? legacyMetadata.models
      : [];
  const modelParameters = cloneModels(metadataParameters.length > 0 ? metadataParameters : config.models);
  normalizedFloors.forEach((floor) => {
    floor.config.floor.scale = scaleRatio;
    floor.config.models = applySharedModelParameters(floor.config.models, modelParameters);
  });
  const activeFloorId =
    typeof metadata?.activeFloorId === 'string' && normalizedFloors.some((floor) => floor.id === metadata.activeFloorId)
      ? metadata.activeFloorId
      : normalizedFloors[0].id;

  return {
    thumbnail: typeof metadata?.thumbnail === 'string' ? metadata.thumbnail : '',
    region: typeof metadata?.region === 'string' ? metadata.region : '',
    address: typeof metadata?.address === 'string' ? metadata.address : '',
    mapOrigin,
    positioningOrigin,
    scaleRatio,
    modelParameters,
    activeFloorId,
    floors: normalizedFloors,
  };
}

function normalizeSavedMap(map: SavedMap): SavedMap {
  const config = cloneSceneConfig(map.config);
  const metadata = createDefaultMetadata(config, map.metadata);
  const activeFloor = metadata.floors.find((floor) => floor.id === metadata.activeFloorId) ?? metadata.floors[0];
  const activeConfig = activeFloor ? cloneSceneConfig(activeFloor.config) : config;
  activeConfig.floor.scale = metadata.scaleRatio;
  activeConfig.models = applySharedModelParameters(activeConfig.models, metadata.modelParameters);
  return {
    ...map,
    name: map.name || config.floor.name || '未命名地图',
    description: map.description || '',
    updatedAt: map.updatedAt || new Date().toISOString(),
    config: activeConfig,
    metadata,
  };
}

export function getDefaultMap(): SavedMap {
  const config = cloneSceneConfig(floorConfig as unknown as SceneConfig);
  const metadata = createDefaultMetadata(config);
  config.floor.scale = metadata.scaleRatio;
  return {
    id: DEFAULT_MAP_ID,
    name: config.floor.name || '默认办公地图',
    description: '系统内置地图配置',
    updatedAt: new Date().toISOString(),
    config,
    metadata,
  };
}

export function getMapLibrary(): SavedMap[] {
  const defaultMap = getDefaultMap();

  try {
    const rawValue = localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
    if (!rawValue) {
      return [defaultMap];
    }

    const parsed = JSON.parse(rawValue) as SavedMap[];
    const customMaps = Array.isArray(parsed)
      ? parsed.filter((item) => item.id !== DEFAULT_MAP_ID && isSceneConfig(item.config)).map(normalizeSavedMap)
      : [];
    return [defaultMap, ...customMaps];
  } catch {
    return [defaultMap];
  }
}

export function saveMapLibrary(maps: SavedMap[]): void {
  const customMaps = maps.filter((item) => item.id !== DEFAULT_MAP_ID);
  localStorage.setItem(MAP_LIBRARY_STORAGE_KEY, JSON.stringify(customMaps));
}

export function getActiveMapId(): string {
  return localStorage.getItem(ACTIVE_MAP_STORAGE_KEY) || DEFAULT_MAP_ID;
}

export function setActiveMapId(mapId: string): void {
  localStorage.setItem(ACTIVE_MAP_STORAGE_KEY, mapId);
}

export function getActiveMap(): SavedMap {
  const maps = getMapLibrary();
  return maps.find((item) => item.id === getActiveMapId()) ?? maps[0] ?? getDefaultMap();
}

/**
 * Convert a SavedMap to the shape expected by the backend config API.
 * The backend uses snake_case field names internally.
 */
export function savedMapToApiPayload(map: SavedMap): {
  name: string;
  description: string;
  config: SceneConfig;
  metadata: MapMetadata;
  thumbnail?: string;
} {
  return {
    name: map.name,
    description: map.description,
    config: cloneSceneConfig(map.config),
    metadata: {
      ...map.metadata,
      mapOrigin: [...map.metadata.mapOrigin] as Point3D,
      positioningOrigin: [...map.metadata.positioningOrigin] as Point3D,
      modelParameters: cloneModels(map.metadata.modelParameters),
      floors: map.metadata.floors.map((floor) => ({
        id: floor.id,
        name: floor.name,
        description: floor.description,
        config: cloneSceneConfig(floor.config),
      })),
    },
    thumbnail: map.metadata.thumbnail || undefined,
  };
}

export function createSavedMap(name: string, description: string, config: SceneConfig, metadata?: Partial<MapMetadata>): SavedMap {
  return {
    id: `map-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    description,
    updatedAt: new Date().toISOString(),
    config: cloneSceneConfig(config),
    metadata: createDefaultMetadata(config, metadata),
  };
}

export function createBlankSceneConfig(name = '新建地图'): SceneConfig {
  return {
    floor: {
      id: `floor-${Date.now()}`,
      name,
      width: 1000,
      height: 600,
      background: '',
      scale: 1,
      origin: [0, 0],
    },
    areas: [],
    walls: [],
    fences: [],
    devices: [],
    models: [],
    overlay: {
      path: '',
      scale: 1,
      offset: [0, 0],
      opacity: 1,
    },
  };
}

export function isSceneConfig(value: unknown): value is SceneConfig {
  const config = value as SceneConfig;
  return Boolean(
    config &&
      typeof config === 'object' &&
      config.floor &&
      typeof config.floor.name === 'string' &&
      Number.isFinite(config.floor.width) &&
      Number.isFinite(config.floor.height) &&
      Array.isArray(config.floor.origin) &&
      Array.isArray(config.areas) &&
      Array.isArray(config.walls) &&
      Array.isArray(config.devices) &&
      Array.isArray(config.models) &&
      config.overlay &&
      typeof config.overlay.path === 'string',
  );
}
