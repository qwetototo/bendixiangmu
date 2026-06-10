export type Point2D = [number, number];

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
}

export interface WallConfig {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number;
  height: number;
  color: string;
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
}

export interface ModelConfig {
  path: string;
  scale: number;
  center: Point2D;
  rotation: [number, number, number];
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
  overlay: OverlayConfig;
}
