import floorConfig from '@/assets/config/config.json';
import type { ModelConfig, Point3D, SceneConfig } from '@/types/scene';
import type { ModelingWorkbenchSnapshot } from '@/types/modelingWorkbench';
import { toRaw } from 'vue';

export interface MapFloorItem {
  id: string;
  name: string;
  description?: string;
  config: SceneConfig;
}

export interface PositioningFloorBinding {
  buildingId: string;
  floorId: string;
  buildingName?: string;
  floorName?: string;
}

export interface FloorPositioningCalibration {
  positioningOrigin: Point3D;
  calibrationScale?: number;
}

export interface MapMetadata {
  schemaVersion: 2;
  /** 与数据库 map_building.building_id 对应的稳定建筑 ID。 */
  buildingId: string;
  thumbnail: string;
  region: string;
  address: string;
  mapOrigin: Point3D;
  positioningOrigin: Point3D;
  scaleRatio: number;
  /** 两点标定得到的比例：1 米真实距离对应的场景单位数（绝对测量值）。 */
  calibrationScale?: number;
  modelParameters: ModelConfig[];
  activeFloorId: string;
  floors: MapFloorItem[];
  /** Browser-only association from a local draft floor to a deployed building floor. */
  positioningBindings?: Record<string, PositioningFloorBinding>;
  /** Browser-only coordinate calibration overrides for individual local draft floors. */
  positioningByFloor?: Record<string, FloorPositioningCalibration>;
  assets?: MapAsset[];
  mapSource?: {
    type: 'geojson' | 'osm' | 'file';
    center?: [number, number];
    geoJson?: unknown;
  };
  /** Exact browser-side editor snapshot used to round-trip the integrated 2D-to-3D workbench. */
  modelingWorkbench?: ModelingWorkbenchSnapshot;
}

export interface MapAsset {
  id: string;
  name: string;
  path: string;
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
const localDraftAssetUrls = new Set<string>();
export const DEFAULT_MAP_ID = 'default-office-floor';

export function registerLocalDraftAssetUrl(url: string): void {
  localDraftAssetUrls.add(url);
}

export function releaseLocalDraftAssetUrl(url: string): void {
  localDraftAssetUrls.delete(url);
  URL.revokeObjectURL(url);
}

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
    id: model.id,
    assetId: model.assetId,
    name: model.name,
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
  const baseParameters = parameters.filter((parameter) => parameter.role === 'base-map');
  let baseIndex = 0;
  return cloneModels(models).map((model) => {
    if (model.role !== 'base-map') return model;
    const parameter = baseParameters[baseIndex++];
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

export function createDefaultMetadata(config: SceneConfig, metadata?: Partial<MapMetadata>, buildingId = ''): MapMetadata {
  const mapOrigin: Point3D = normalizePoint3D(metadata?.mapOrigin, [0, 0, 0]);
  const positioningOrigin = normalizePoint3D(metadata?.positioningOrigin, mapOrigin);
  const metadataScaleRatio = Number(metadata?.scaleRatio);
  const configScaleRatio = Number(config.floor.scale);
  const scaleRatio =
    Number.isFinite(metadataScaleRatio) && metadataScaleRatio > 0
      ? metadataScaleRatio
      : Number.isFinite(configScaleRatio) && configScaleRatio > 0
        ? configScaleRatio
        : 1;
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
  const modelParameters = cloneModels(metadataParameters.length > 0 ? metadataParameters : config.models.filter((model) => model.role === 'base-map'));
  normalizedFloors.forEach((floor) => {
    floor.config.floor.scale = scaleRatio;
    floor.config.models = applySharedModelParameters(floor.config.models, modelParameters);
  });
  const activeFloorId =
    typeof metadata?.activeFloorId === 'string' && normalizedFloors.some((floor) => floor.id === metadata.activeFloorId)
      ? metadata.activeFloorId
      : normalizedFloors[0].id;
  const rawCalibrationScale = Number(metadata?.calibrationScale);
  const calibrationScale =
    Number.isFinite(rawCalibrationScale) && rawCalibrationScale > 0 ? rawCalibrationScale : undefined;
  const rawPositioningBindings = metadata?.positioningBindings;
  const positioningBindings = rawPositioningBindings && typeof rawPositioningBindings === 'object'
    ? Object.fromEntries(
        Object.entries(rawPositioningBindings)
          .filter(([floorId, binding]) => {
            const item = binding as Partial<PositioningFloorBinding> | null;
            return normalizedFloors.some((floor) => floor.id === floorId)
              && typeof item?.buildingId === 'string'
              && typeof item.floorId === 'string';
          })
          .map(([floorId, binding]) => {
            const item = binding as PositioningFloorBinding;
            return [floorId, {
              buildingId: item.buildingId,
              floorId: item.floorId,
              buildingName: typeof item.buildingName === 'string' ? item.buildingName : undefined,
              floorName: typeof item.floorName === 'string' ? item.floorName : undefined,
            }];
          }),
      ) as Record<string, PositioningFloorBinding>
    : {};
  const rawPositioningByFloor = metadata?.positioningByFloor;
  const positioningByFloor = rawPositioningByFloor && typeof rawPositioningByFloor === 'object'
    ? Object.fromEntries(
        Object.entries(rawPositioningByFloor)
          .filter(([floorId, calibration]) => {
            const item = calibration as Partial<FloorPositioningCalibration> | null;
            return normalizedFloors.some((floor) => floor.id === floorId) && Array.isArray(item?.positioningOrigin);
          })
          .map(([floorId, calibration]) => {
            const item = calibration as FloorPositioningCalibration;
            const scale = Number(item.calibrationScale);
            return [floorId, {
              positioningOrigin: normalizePoint3D(item.positioningOrigin, positioningOrigin),
              calibrationScale: Number.isFinite(scale) && scale > 0 ? scale : undefined,
            }];
          }),
      ) as Record<string, FloorPositioningCalibration>
    : {};

  return {
    schemaVersion: 2,
    buildingId: typeof metadata?.buildingId === 'string' && metadata.buildingId ? metadata.buildingId : buildingId,
    thumbnail: typeof metadata?.thumbnail === 'string' ? metadata.thumbnail : '',
    region: typeof metadata?.region === 'string' ? metadata.region : '',
    address: typeof metadata?.address === 'string' ? metadata.address : '',
    mapOrigin,
    positioningOrigin,
    scaleRatio,
    calibrationScale,
    modelParameters,
    activeFloorId,
    floors: normalizedFloors,
    positioningBindings,
    positioningByFloor,
    assets: Array.isArray(metadata?.assets)
      ? metadata.assets.filter((asset) => asset && typeof asset.id === 'string' && typeof asset.path === 'string')
      : [],
    mapSource: metadata?.mapSource,
    modelingWorkbench: metadata?.modelingWorkbench,
  };
}

function normalizeSavedMap(map: SavedMap): SavedMap {
  const config = cloneSceneConfig(map.config);
  const metadata = createDefaultMetadata(config, map.metadata, map.id);
  if (isLocalDraftMap(map)) {
    const isAvailableAssetPath = (path: string) => !path.startsWith('blob:') || localDraftAssetUrls.has(path);
    const availableAssets = (metadata.assets || []).filter((asset) => isAvailableAssetPath(asset.path));
    const assetIds = new Set(availableAssets.map((asset) => asset.id));
    const keepModel = (model: ModelConfig) => isAvailableAssetPath(model.path) && (!model.assetId || assetIds.has(model.assetId));
    metadata.assets = availableAssets;
    metadata.modelParameters = metadata.modelParameters.filter(keepModel);
    metadata.floors.forEach((floor) => {
      floor.config.models = floor.config.models.filter(keepModel);
    });
    config.models = config.models.filter(keepModel);
    if (metadata.thumbnail.startsWith('blob:') && !localDraftAssetUrls.has(metadata.thumbnail)) metadata.thumbnail = '';
  }
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

/**
 * 内置模板地图（overlay 底图，无 base-map GLB）的定位标定。
 * 历史上由 DEFAULT_POSITION_TRANSFORM 提供（scale 14.5 / 偏移 -84.95, 79.67），
 * 现在固化到模板地图 metadata，保证其行为不变，同时让默认变换回归中性 1:1。
 */
const TEMPLATE_MAP_CALIBRATION: Partial<MapMetadata> = {
  calibrationScale: 14.5,
  positioningOrigin: [-84.95, 0, 79.67],
};

export function getDefaultMap(): SavedMap {
  const config = cloneSceneConfig(floorConfig as unknown as SceneConfig);
  const metadata = createDefaultMetadata(config, TEMPLATE_MAP_CALIBRATION, DEFAULT_MAP_ID);
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
  const id = `map-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id,
    name,
    description,
    updatedAt: new Date().toISOString(),
    config: cloneSceneConfig(config),
    metadata: createDefaultMetadata(config, metadata, id),
  };
}

export function createLocalDraftMap(name: string, description: string, config: SceneConfig, metadata?: Partial<MapMetadata>): SavedMap {
  const map = createSavedMap(name, description, config, metadata);
  map.id = `local-map-${crypto.randomUUID()}`;
  map.metadata.buildingId = map.id;
  return map;
}

export function isLocalDraftMap(map: Pick<SavedMap, 'id'> | string | null | undefined): boolean {
  if (!map) return false;
  const id = typeof map === 'string' ? map : map.id;
  return id.startsWith('local-map-');
}

export function createBlankSceneConfig(name: string): SceneConfig {
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
    doors: [],
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
