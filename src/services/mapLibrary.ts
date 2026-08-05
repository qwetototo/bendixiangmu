import floorConfig from '@/assets/config/config.json';
import type { Point3D, SceneConfig } from '@/types/scene';
import { toRaw } from 'vue';

export interface MapFloorItem {
  id: string;
  name: string;
  description?: string;
  config: SceneConfig;
  scaleRatio?: number;
  positioningOrigin?: Point3D;
}

export interface MapMetadata {
  thumbnail: string;
  floor: string;
  region: string;
  address: string;
  mapOrigin: Point3D;
  positioningOrigin: Point3D;
  scaleRatio: number;
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
    scaleRatio,
    positioningOrigin: [...positioningOrigin] as Point3D,
  };
  const floors = Array.isArray(metadata?.floors)
    ? metadata.floors
        .filter((floor) => floor && typeof floor.id === 'string' && isSceneConfig(floor.config))
        .map((floor) => ({
          id: floor.id,
          name: floor.name || floor.config.floor.name || floor.id,
          description: typeof floor.description === 'string' ? floor.description : '',
          config: cloneSceneConfig(floor.config),
          scaleRatio: floor.scaleRatio,
          positioningOrigin: floor.positioningOrigin ? ([...floor.positioningOrigin] as Point3D) : undefined,
        }))
    : [];
  const normalizedFloors = floors.length > 0 ? floors : [fallbackFloor];
  normalizedFloors.forEach((floor) => {
    if (floor.scaleRatio === undefined) {
      floor.scaleRatio = scaleRatio;
    }
    if (floor.positioningOrigin === undefined) {
      floor.positioningOrigin = [...positioningOrigin] as Point3D;
    }
    floor.config.floor.scale = floor.scaleRatio;
  });
  const activeFloorId =
    typeof metadata?.activeFloorId === 'string' && normalizedFloors.some((floor) => floor.id === metadata.activeFloorId)
      ? metadata.activeFloorId
      : normalizedFloors[0].id;

  return {
    thumbnail: typeof metadata?.thumbnail === 'string' ? metadata.thumbnail : '',
    floor: typeof metadata?.floor === 'string' && metadata.floor.trim() ? metadata.floor : config.floor.name || '1F',
    region: typeof metadata?.region === 'string' ? metadata.region : '',
    address: typeof metadata?.address === 'string' ? metadata.address : '',
    mapOrigin,
    positioningOrigin,
    scaleRatio,
    activeFloorId,
    floors: normalizedFloors,
  };
}

function normalizeSavedMap(map: SavedMap): SavedMap {
  const config = cloneSceneConfig(map.config);
  const metadata = createDefaultMetadata(config, map.metadata);
  const activeFloor = metadata.floors.find((floor) => floor.id === metadata.activeFloorId) ?? metadata.floors[0];
  const activeConfig = activeFloor ? cloneSceneConfig(activeFloor.config) : config;
  // Use the active floor's own scaleRatio instead of the global metadata.scaleRatio
  if (activeFloor && typeof activeFloor.scaleRatio === 'number' && activeFloor.scaleRatio > 0) {
    activeConfig.floor.scale = activeFloor.scaleRatio;
  } else {
    activeConfig.floor.scale = metadata.scaleRatio;
  }
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
    metadata: { ...map.metadata },
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
