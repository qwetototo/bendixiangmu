import * as THREE from 'three';
import type { FenceConfig, FloorConfig, SceneConfig } from '@/types/scene';
import { createAreaMesh } from '@/three/objects/createAreaMesh';
import { createDeviceMesh } from '@/three/objects/createDeviceMesh';
import { createWallMesh } from '@/three/objects/createWallMesh';
import { createFenceMesh } from '@/three/objects/createFenceMesh';

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

export class SceneBuilder {
  build(config: SceneConfig): THREE.Group {
    const sceneGroup = new THREE.Group();
    sceneGroup.name = 'twin-floor';

    config.areas.forEach((area) => sceneGroup.add(createAreaMesh(area)));
    config.walls.forEach((wall) => sceneGroup.add(createWallMesh(wall)));

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
