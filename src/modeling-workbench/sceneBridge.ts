import {
  cloneSceneConfig,
  createDefaultMetadata,
  getMapLibrary,
  saveMapLibrary,
  type MapMetadata,
  type SavedMap,
} from '@/services/mapLibrary';
import type { DeviceConfig, SceneConfig, WallConfig } from '@/types/scene';
import type { ModelingFloorSnapshot, ModelingPlan, ModelingPoint, ModelingWorkbenchSnapshot } from '@/types/modelingWorkbench';
import { modelingAssetPath } from './assetCache';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 680;
const METERS_PER_PIXEL = 0.08;
const SCENE_UNITS_PER_METER = 1 / METERS_PER_PIXEL;
const DEFAULT_WALL_THICKNESS_METERS = 0.16;
const FLOOR_SLAB_THICKNESS_METERS = 0.16;

function toScenePoint(point: ModelingPoint, modelScale = 1): [number, number] {
  const x = CANVAS_WIDTH / 2 + (point.x - CANVAS_WIDTH / 2) * modelScale;
  const y = CANVAS_HEIGHT / 2 + (point.y - CANVAS_HEIGHT / 2) * modelScale;
  return [x, CANVAS_HEIGHT - y];
}

function wallFromSegment(
  id: string,
  start: ModelingPoint,
  end: ModelingPoint,
  height: number,
  modelScale: number,
  baseHeight = 0,
): WallConfig | null {
  const sceneStart = toScenePoint(start, modelScale);
  const sceneEnd = toScenePoint(end, modelScale);
  if (Math.hypot(sceneEnd[0] - sceneStart[0], sceneEnd[1] - sceneStart[1]) < 0.01) return null;
  return {
    id,
    start: sceneStart,
    end: sceneEnd,
    thickness: DEFAULT_WALL_THICKNESS_METERS * SCENE_UNITS_PER_METER * modelScale,
    height: height * SCENE_UNITS_PER_METER * modelScale,
    color: '#d9e1e8',
    baseHeight,
  };
}

function planToConfig(floor: ModelingFloorSnapshot, sourceConfig: SceneConfig | undefined, modelScale: number): SceneConfig {
  const wallHeight = Math.max(2.4, Number(floor.height) || 3.2);
  const walls: WallConfig[] = [];

  floor.plan.buildings.forEach((building) => {
    if (building.closed === false || building.outer.length < 3) return;
    building.outer.forEach((point, index) => {
      const wall = wallFromSegment(
        `outer:${building.id}:${index}`,
        point,
        building.outer[(index + 1) % building.outer.length],
        wallHeight,
        modelScale,
      );
      if (wall) walls.push(wall);
    });
  });

  floor.plan.walls.forEach((wall) => {
    const result = wallFromSegment(
      wall.id,
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
      wallHeight,
      modelScale,
      FLOOR_SLAB_THICKNESS_METERS * SCENE_UNITS_PER_METER * modelScale,
    );
    if (result) walls.push(result);
  });

  const doors = floor.plan.doors.map((door) => {
    const position = toScenePoint(door, modelScale);
    const nearest = walls.reduce<{ wall: WallConfig | null; distance: number }>((best, wall) => {
      const [x1, y1] = wall.start;
      const [x2, y2] = wall.end;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((position[0] - x1) * dx + (position[1] - y1) * dy) / lengthSquared)) : 0;
      const distance = Math.hypot(position[0] - (x1 + dx * t), position[1] - (y1 + dy * t));
      return distance < best.distance ? { wall, distance } : best;
    }, { wall: null, distance: Number.POSITIVE_INFINITY }).wall;
    const rotation = nearest
      ? Math.atan2(nearest.end[1] - nearest.start[1], nearest.end[0] - nearest.start[0]) * 180 / Math.PI
      : 0;
    return {
      id: door.id,
      name: door.name || '门',
      position,
      width: Math.max(0.5, Number(door.width) || 0.9) * SCENE_UNITS_PER_METER * modelScale,
      height: 2.1 * SCENE_UNITS_PER_METER * modelScale,
      rotation,
      color: '#b78658',
      baseHeight: FLOOR_SLAB_THICKNESS_METERS * SCENE_UNITS_PER_METER * modelScale,
    };
  });

  const areas = floor.plan.buildings
    .filter((building) => building.closed !== false && building.outer.length >= 3)
    .map((building) => ({
      id: building.id,
      name: building.name || '建筑轮廓',
      type: 'building',
      height: FLOOR_SLAB_THICKNESS_METERS * SCENE_UNITS_PER_METER * modelScale,
      color: '#d9e1e8',
      opacity: 0.2,
      points: building.outer.map((point) => toScenePoint(point, modelScale)),
    }));
  const modelingAssets: DeviceConfig[] = floor.plan.assets.flatMap((asset, index) => {
    const x = Number(asset.x);
    const y = Number(asset.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    if (asset.storageId && asset.format === 'glb') return [];
    return [{
      id: `modeling-asset:${asset.instanceId || `${asset.id}-${index}`}`,
      name: String(asset.name || '小模型'),
      type: String(asset.type || 'custom'),
      position: toScenePoint({ x, y }, modelScale),
      color: typeof asset.color === 'string' ? asset.color : '#dfaa55',
      rotation: Number(asset.rotation) || 0,
      modelingAsset: true,
      assetScale: SCENE_UNITS_PER_METER * modelScale,
      baseHeight: FLOOR_SLAB_THICKNESS_METERS * SCENE_UNITS_PER_METER * modelScale,
    }];
  });
  const modelingModels = floor.plan.assets.flatMap((asset, index) => {
    const storageId = typeof asset.storageId === 'string' ? asset.storageId : '';
    const x = Number(asset.x);
    const y = Number(asset.y);
    if (!storageId || asset.format !== 'glb' || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    const scale = Number(asset.scale);
    const rotation = Number(asset.rotation);
    return [{
      id: `modeling-asset:${asset.instanceId || `${storageId}-${index}`}`,
      assetId: storageId,
      name: String(asset.name || '小模型'),
      path: modelingAssetPath(storageId),
      scale: (Number.isFinite(scale) && scale > 0 ? scale : 1) * SCENE_UNITS_PER_METER * modelScale,
      center: [
        (x - CANVAS_WIDTH / 2) * modelScale,
        FLOOR_SLAB_THICKNESS_METERS * SCENE_UNITS_PER_METER * modelScale,
        (CANVAS_HEIGHT / 2 - y) * modelScale,
      ] as [number, number, number],
      rotation: [0, Number.isFinite(rotation) ? rotation : 0, 0] as [number, number, number],
    }];
  });

  const floorConfig = sourceConfig ? cloneSceneConfig(sourceConfig) : undefined;
  return {
    floor: {
      id: floor.id,
      name: floor.name,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      background: floorConfig?.floor.background || '',
      scale: modelScale,
      origin: [0, 0],
    },
    areas,
    walls,
    fences: floorConfig?.fences ?? [],
    devices: [
      ...(floorConfig?.devices ?? []).filter((device) => !device.id.startsWith('modeling-asset:')),
      ...modelingAssets,
    ],
    models: [
      ...(floorConfig?.models ?? []).filter((model) => !model.path.startsWith('modeling-asset://')),
      ...modelingModels,
    ],
    doors,
    overlay: floorConfig?.overlay ?? { path: '', scale: 1, offset: [0, 0], opacity: 1 },
  };
}

function clonePlan(plan: ModelingPlan): ModelingPlan {
  return JSON.parse(JSON.stringify(plan, (key, value) => key === 'url' ? undefined : value)) as ModelingPlan;
}

export function buildModelingSnapshot(state: {
  floors: ModelingFloorSnapshot[];
  assets: ModelingWorkbenchSnapshot['assets'];
  modelSettings: ModelingWorkbenchSnapshot['settings'];
}): ModelingWorkbenchSnapshot {
  return {
    version: 1,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, metersPerPixel: METERS_PER_PIXEL },
    floors: state.floors.map((floor) => ({ ...floor, plan: clonePlan(floor.plan) })),
    assets: JSON.parse(JSON.stringify(state.assets, (key, value) => key === 'url' ? undefined : value)) as ModelingWorkbenchSnapshot['assets'],
    settings: state.modelSettings ? JSON.parse(JSON.stringify(state.modelSettings)) : undefined,
  };
}

export function publishModelingDraft(
  state: {
    project: { id: string; name: string; region: string; address: string; description: string };
    floors: ModelingFloorSnapshot[];
    activeFloorId: string;
    assets: ModelingWorkbenchSnapshot['assets'];
    modelSettings: NonNullable<ModelingWorkbenchSnapshot['settings']>;
  },
  seed: SavedMap,
): SavedMap {
  const modelScale = Math.min(10, Math.max(0.1, Number(state.modelSettings.modelScale) || 1));
  const snapshot = buildModelingSnapshot(state);
  const previousAssetIds = new Set((seed.metadata.modelingWorkbench?.assets || [])
    .map((asset) => typeof asset.storageId === 'string' ? asset.storageId : '')
    .filter(Boolean));
  const retainedAssets = (seed.metadata.assets || []).filter((asset) => !previousAssetIds.has(asset.id));
  const uploadedAssets = state.assets.flatMap((asset) => {
    const storageId = typeof asset.storageId === 'string' ? asset.storageId : '';
    if (!storageId || asset.format !== 'glb') return [];
    return [{ id: storageId, name: String(asset.name || '小模型'), path: modelingAssetPath(storageId) }];
  });
  const sourceFloors = new Map(seed.metadata.floors.map((floor) => [floor.id, floor]));
  const floors = state.floors.map((floor) => ({
    id: floor.id,
    name: floor.name,
    description: floor.note,
    config: planToConfig(floor, sourceFloors.get(floor.id)?.config, modelScale),
  }));
  const activeFloor = floors.find((floor) => floor.id === state.activeFloorId) ?? floors[0];
  if (!activeFloor) throw new Error('模型至少需要保留一个楼层');

  const [originX, originY, originZ] = state.modelSettings.positioningOrigin;
  const positioningOrigin: [number, number, number] = [
    originX * SCENE_UNITS_PER_METER * modelScale,
    originY * SCENE_UNITS_PER_METER * modelScale,
    originZ * SCENE_UNITS_PER_METER * modelScale,
  ];
  const calibrationScale = Math.max(0.001, Number(state.modelSettings.calibrationScale) || 1)
    * modelScale * SCENE_UNITS_PER_METER;
  const positioningByFloor = Object.fromEntries(floors.map((floor) => [floor.id, {
    positioningOrigin,
    calibrationScale,
  }]));
  const metadata = createDefaultMetadata(activeFloor.config, {
    ...seed.metadata,
    buildingId: seed.id,
    region: state.project.region,
    address: state.project.address,
    scaleRatio: modelScale,
    positioningOrigin,
    calibrationScale,
    positioningByFloor,
    activeFloorId: activeFloor.id,
    floors,
    modelingWorkbench: snapshot,
  } as Partial<MapMetadata>, seed.id);
  metadata.assets = [...retainedAssets, ...uploadedAssets];
  const saved: SavedMap = {
    ...seed,
    name: state.project.name.trim() || '未命名模型',
    description: state.project.description,
    updatedAt: new Date().toISOString(),
    config: cloneSceneConfig(activeFloor.config),
    metadata,
  };

  const maps = getMapLibrary();
  saveMapLibrary([saved, ...maps.filter((map) => map.id !== saved.id)]);
  return saved;
}
