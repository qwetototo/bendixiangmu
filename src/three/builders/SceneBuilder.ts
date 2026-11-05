import * as THREE from 'three';
import type { DoorConfig, FenceConfig, FloorConfig, SceneConfig, WallConfig } from '@/types/scene';
import { createAreaMesh } from '@/three/objects/createAreaMesh';
import { createDeviceMesh } from '@/three/objects/createDeviceMesh';
import { createWallMesh } from '@/three/objects/createWallMesh';
import { createFenceMesh } from '@/three/objects/createFenceMesh';
import { createDoorMesh } from '@/three/objects/createDoorMesh';

/**
 * 判断一个围栏是否完全被另一个围栏包含（排除超大边界围栏）
 */
function isFenceContained(inner: FenceConfig, outer: FenceConfig): boolean {
  const outerArea = (outer.maxX - outer.minX) * (outer.maxY - outer.minY);
  // 排除超大边界围栏（面积 > 50000），避免所有围栏都归为它的子区域
  if (outerArea > 50000) return false;
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  );
}

/**
 * 根据面积从大到小排序
 */
function sortFencesByArea(fences: FenceConfig[]): FenceConfig[] {
  return [...fences].sort((a, b) => {
    const areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
    const areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
    return areaB - areaA;
  });
}

/**
 * 确定哪些围栏需要显示标签——仅父级围栏（不被其他非超大围栏包含的）显示标签
 */
function determineLabelFences(fences: FenceConfig[]): Set<string> {
  const sorted = sortFencesByArea(fences);
  const hasLabel = new Set<string>();

  for (const fence of sorted) {
    let contained = false;
    for (const other of sorted) {
      if (other.id === fence.id) continue;
      if (isFenceContained(fence, other)) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      hasLabel.add(fence.id);
    }
  }
  return hasLabel;
}

function splitWallAtDoors(wall: WallConfig, doors: DoorConfig[]): WallConfig[] {
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.01 || doors.length === 0) return [wall];
  const intervals = doors.flatMap((door) => {
    const doorAngle = (door.rotation * Math.PI) / 180;
    const doorDx = Math.cos(doorAngle);
    const doorDz = Math.sin(doorAngle);
    const parallel = Math.abs((dx * doorDx + dz * doorDz) / length);
    if (parallel < 0.72) return [];
    const t = ((door.position[0] - wall.start[0]) * dx + (door.position[1] - wall.start[1]) * dz) / (length * length);
    const closestX = wall.start[0] + t * dx;
    const closestZ = wall.start[1] + t * dz;
    if (Math.hypot(door.position[0] - closestX, door.position[1] - closestZ) > Math.max(wall.thickness, 0.18) + 0.3) return [];
    const halfOpening = Math.max(door.width, 0.5) / (2 * length);
    const start = Math.max(0, t - halfOpening);
    const end = Math.min(1, t + halfOpening);
    return end - start > 0.02 ? [{ start, end }] : [];
  }).sort((a, b) => a.start - b.start);
  if (!intervals.length) return [wall];
  const result: WallConfig[] = [];
  let cursor = 0;
  intervals.forEach((interval, index) => {
    const from = Math.max(cursor, interval.start);
    if (from - cursor > 0.01) {
      result.push({ ...wall, id: `${wall.id}:segment:${index}`, start: [wall.start[0] + dx * cursor, wall.start[1] + dz * cursor], end: [wall.start[0] + dx * from, wall.start[1] + dz * from] });
    }
    cursor = Math.max(cursor, interval.end);
  });
  if (1 - cursor > 0.01) {
    result.push({ ...wall, id: `${wall.id}:segment:end`, start: [wall.start[0] + dx * cursor, wall.start[1] + dz * cursor], end: wall.end });
  }
  return result.length ? result : [];
}

export class SceneBuilder {
  build(config: SceneConfig, exteriorWallIds: ReadonlySet<string> = new Set()): THREE.Group {
    const sceneGroup = new THREE.Group();
    sceneGroup.name = 'twin-floor';

    const buildingFootprints = getBuildingFootprints(config.areas);
    const buildingFootprintIds = new Set(buildingFootprints.map((area) => area.id));
    config.areas.forEach((area) => sceneGroup.add(createAreaMesh(area, buildingFootprintIds.has(area.id))));
    const doors = config.doors ?? [];
    const generatedOuterWalls = config.walls.filter((wall) => wall.id.startsWith('outer:'));
    const walls = config.walls.filter((wall) => (
      wall.id.startsWith('outer:') || !generatedOuterWalls.some((outerWall) => isWallCoveredBy(wall, outerWall))
    ));
    walls.flatMap((wall) => splitWallAtDoors(wall, doors)).forEach((wall) => {
      const sourceWallId = wall.id.split(':segment:')[0];
      const isExterior = wall.id.startsWith('outer:') || exteriorWallIds.has(sourceWallId) || isWallOnBuildingBoundary(wall, buildingFootprints);
      sceneGroup.add(createWallMesh(wall, isExterior));
    });
    doors.forEach((door) => sceneGroup.add(createDoorMesh(door)));

    // 围栏分组：同一办公区只显示一个标签
    const labelFences = determineLabelFences(config.fences);
    config.fences.forEach((fence) => {
      const showLabel = labelFences.has(fence.id);
      sceneGroup.add(createFenceMesh(fence, showLabel));
    });

    config.devices.forEach((device) => sceneGroup.add(createDeviceMesh(device)));

    this.centerGroup(sceneGroup, config.floor);

    return sceneGroup;
  }

  private centerGroup(group: THREE.Group, floor: FloorConfig): void {
    const offsetX = floor.origin[0] + floor.width / 2;
    const offsetZ = floor.origin[1] + floor.height / 2;
    group.position.set(-offsetX, 0, -offsetZ);
  }
}

function getBuildingFootprints(areas: SceneConfig['areas']): SceneConfig['areas'] {
  const explicitFootprints = areas.filter((area) => area.type === 'building' && area.points.length >= 3);
  if (explicitFootprints.length > 0) return explicitFootprints;

  const legacyFloorAreas = areas.filter((area) => area.type === 'floor' && area.points.length >= 3);
  if (legacyFloorAreas.length === 0) return [];
  return [legacyFloorAreas.reduce((largest, area) => polygonArea(area.points) > polygonArea(largest.points) ? area : largest)];
}

function polygonArea(points: [number, number][]): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function isWallCoveredBy(wall: WallConfig, candidate: WallConfig): boolean {
  return pointOnSegment(wall.start, candidate.start, candidate.end)
    && pointOnSegment(wall.end, candidate.start, candidate.end);
}

function isWallOnBuildingBoundary(wall: WallConfig, areas: SceneConfig['areas']): boolean {
  return areas.some((area) => area.points.some((start, index) => {
    const end = area.points[(index + 1) % area.points.length];
    return pointOnSegment(wall.start, start, end) && pointOnSegment(wall.end, start, end);
  }));
}

function pointOnSegment(point: [number, number], start: [number, number], end: [number, number], tolerance = 1.25): boolean {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return false;
  const projection = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (length * length);
  if (projection < -tolerance / length || projection > 1 + tolerance / length) return false;
  const nearestX = start[0] + dx * projection;
  const nearestY = start[1] + dy * projection;
  return Math.hypot(point[0] - nearestX, point[1] - nearestY) <= tolerance;
}
