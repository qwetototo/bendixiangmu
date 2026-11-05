export interface ModelingPoint {
  x: number;
  y: number;
}

export interface ModelingPlan {
  buildings: Array<{
    id: string;
    name?: string;
    closed?: boolean;
    outer: ModelingPoint[];
  }>;
  rooms: Array<Record<string, unknown>>;
  walls: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>;
  doors: Array<{
    id: string;
    name?: string;
    x: number;
    y: number;
    width?: number;
  }>;
  assets: Array<Record<string, unknown> & {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
  }>;
  siteFeatures: Array<Record<string, unknown>>;
  referenceImage: string | null;
  uploaded3d?: { name: string; url?: string };
}

export interface ModelingFloorSnapshot {
  id: string;
  name: string;
  height: number;
  note: string;
  plan: ModelingPlan;
}

export interface ModelingWorkbenchSnapshot {
  version: 1;
  canvas: { width: number; height: number; metersPerPixel: number };
  floors: ModelingFloorSnapshot[];
  assets: Array<Record<string, unknown> & { id: string; name: string; type: string }>;
  settings?: {
    modelScale: number;
    positioningOrigin: [number, number, number];
    calibrationScale: number;
    calibrationRealDistance: number;
    calibrationPoints: { a: [number, number, number] | null; b: [number, number, number] | null };
  };
}
