import * as THREE from 'three';
import type { DeviceConfig } from '@/types/scene';

export function createDeviceMesh(device: DeviceConfig): THREE.Object3D {
  const group = new THREE.Group();
  const radius = device.radius ?? 3;
  const height = device.height ?? 8;

  const pillarGeometry = new THREE.CylinderGeometry(radius, radius, height, 24);
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: device.color ?? '#4DD0E1',
    emissive: new THREE.Color(device.color ?? '#4DD0E1').multiplyScalar(0.2),
    metalness: 0.25,
    roughness: 0.4,
  });
  const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  pillar.position.y = height / 2;
  pillar.castShadow = true;
  pillar.receiveShadow = true;

  const capGeometry = new THREE.SphereGeometry(radius * 0.8, 24, 24);
  const capMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: new THREE.Color(device.color ?? '#4DD0E1').multiplyScalar(0.5),
    transparent: true,
    opacity: 0.9,
  });
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = height + radius * 0.7;

  group.name = `device:${device.id}`;
  group.position.set(device.position[0], 0, device.position[1]);
  group.add(pillar, cap);

  return group;
}
