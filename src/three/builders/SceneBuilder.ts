import * as THREE from 'three';
import type { FloorConfig, SceneConfig } from '@/types/scene';
import { createAreaMesh } from '@/three/objects/createAreaMesh';
import { createDeviceMesh } from '@/three/objects/createDeviceMesh';
import { createWallMesh } from '@/three/objects/createWallMesh';

export class SceneBuilder {
  build(config: SceneConfig): THREE.Group {
    const sceneGroup = new THREE.Group();
    sceneGroup.name = 'twin-floor';

    config.areas.forEach((area) => sceneGroup.add(createAreaMesh(area)));
    config.walls.forEach((wall) => sceneGroup.add(createWallMesh(wall)));
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
