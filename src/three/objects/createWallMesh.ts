import * as THREE from 'three';
import type { Point2D, WallConfig } from '@/types/scene';

function pointDistance(start: Point2D, end: Point2D): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1]);
}

export function createWallMesh(wall: WallConfig): THREE.Group {
  const length = pointDistance(wall.start, wall.end);
  const wallGeometry = new THREE.BoxGeometry(length, wall.height, wall.thickness);
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: wall.color,
    roughness: 0.65,
    metalness: 0.18,
  });

  const centerX = (wall.start[0] + wall.end[0]) / 2;
  const centerZ = (wall.start[1] + wall.end[1]) / 2;
  const angle = Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]);
  const group = new THREE.Group();
  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);

  wallMesh.position.y = wall.height / 2;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;

  group.name = `wall:${wall.id}`;
  group.position.set(centerX, 0, centerZ);
  group.rotation.y = -angle;
  group.add(wallMesh);

  return group;
}
