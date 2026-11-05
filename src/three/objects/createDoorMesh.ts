import * as THREE from 'three';
import type { DoorConfig } from '@/types/scene';

export function createDoorMesh(door: DoorConfig): THREE.Group {
  const group = new THREE.Group();
  const width = Math.max(door.width, 0.5);
  const height = Math.max(door.height, 1);
  const frameWidth = Math.min(width * 0.08, 0.12);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: door.color, roughness: 0.52 });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: '#e7b65c',
    roughness: 0.72,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const addBox = (name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = `door:${door.id}:${name}`;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  addBox('left-jamb', [frameWidth, height, frameWidth], [-width / 2, height / 2, 0], frameMaterial);
  addBox('right-jamb', [frameWidth, height, frameWidth], [width / 2, height / 2, 0], frameMaterial);
  addBox('lintel', [width + frameWidth, frameWidth, frameWidth], [0, height - frameWidth / 2, 0], frameMaterial);
  addBox('leaf', [width - frameWidth, height - frameWidth, frameWidth * 0.42], [0, (height - frameWidth) / 2, -frameWidth * 0.12], leafMaterial);

  const marker = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(width * 0.24, 0.18), 24),
    new THREE.MeshBasicMaterial({ color: door.color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  marker.name = `door:${door.id}:floor-marker`;
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.035;
  marker.renderOrder = 8;
  group.add(marker);

  group.name = `door:${door.id}`;
  group.position.set(door.position[0], door.baseHeight ?? 0, door.position[1]);
  group.rotation.y = -THREE.MathUtils.degToRad(door.rotation || 0);
  return group;
}
