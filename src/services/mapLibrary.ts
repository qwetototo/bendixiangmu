import floorConfig from '@/assets/config/config.json';
import type { SceneConfig } from '@/types/scene';
import { toRaw } from 'vue';

export interface SavedMap {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  config: SceneConfig;
}

const MAP_LIBRARY_STORAGE_KEY = 'twintrack.mapLibrary';
const ACTIVE_MAP_STORAGE_KEY = 'twintrack.activeMapId';
export const DEFAULT_MAP_ID = 'default-office-floor';

export function cloneSceneConfig(config: SceneConfig): SceneConfig {
  return JSON.parse(JSON.stringify(toRaw(config))) as SceneConfig;
}

export function getDefaultMap(): SavedMap {
  const config = cloneSceneConfig(floorConfig as unknown as SceneConfig);
  return {
    id: DEFAULT_MAP_ID,
    name: config.floor.name || '默认办公地图',
    description: '系统内置地图配置',
    updatedAt: new Date().toISOString(),
    config,
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
    const customMaps = Array.isArray(parsed) ? parsed.filter((item) => item.id !== DEFAULT_MAP_ID && isSceneConfig(item.config)) : [];
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

export function createSavedMap(name: string, description: string, config: SceneConfig): SavedMap {
  return {
    id: `map-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    description,
    updatedAt: new Date().toISOString(),
    config: cloneSceneConfig(config),
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
