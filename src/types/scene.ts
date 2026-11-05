export type Point2D = [number, number];
export type Point3D = [number, number, number];

export interface FloorConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  scale: number;
  origin: Point2D;
}

export interface AreaConfig {
  id: string;
  name: string;
  type: string;
  height: number;
  color: string;
  opacity: number;
  points: Point2D[];
  groupId?: string;
}

export interface WallConfig {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number;
  height: number;
  color: string;
  baseHeight?: number;
  groupId?: string;
}

export interface DoorConfig {
  id: string;
  name: string;
  position: Point2D;
  width: number;
  height: number;
  rotation: number;
  color: string;
  baseHeight?: number;
}

export interface FenceConfig {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  height: number;
  color: string;
  groupId?: string;
}

export interface DeviceConfig {
  id: string;
  name: string;
  type: string;
  position: Point2D;
  areaId?: string;
  color?: string;
  radius?: number;
  height?: number;
  rotation?: number;
  modelingAsset?: boolean;
  assetScale?: number;
  baseHeight?: number;
}

export interface ModelConfig {
  id?: string;
  assetId?: string;
  name?: string;
  path: string;
  scale: number;
  center: Point3D;
  rotation: [number, number, number];
  role?: 'base-map';
}

export interface OverlayConfig {
  path: string;
  scale: number;
  offset: Point2D;
  opacity: number;
}

export interface SceneConfig {
  floor: FloorConfig;
  areas: AreaConfig[];
  walls: WallConfig[];
  fences: FenceConfig[];
  devices: DeviceConfig[];
  models: ModelConfig[];
  doors?: DoorConfig[];
  overlay: OverlayConfig;
}
