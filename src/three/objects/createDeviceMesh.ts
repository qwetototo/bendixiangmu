import * as THREE from 'three';
import type { DeviceConfig } from '@/types/scene';

export function createDeviceMesh(device: DeviceConfig): THREE.Object3D {
  const group = new THREE.Group();
  group.name = device.modelingAsset ? `modeling-asset:${device.name}` : `device:${device.id}`;
  group.position.set(device.position[0], device.baseHeight ?? 0, device.position[1]);

  if (device.modelingAsset) {
    createModelingAsset(group, device);
    group.rotation.y = ((device.rotation ?? 0) * Math.PI) / 180;
    return group;
  }

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

  group.add(pillar, cap);

  return group;
}

function createModelingAsset(group: THREE.Group, device: DeviceConfig): void {
  const scale = Number.isFinite(device.assetScale) && (device.assetScale ?? 0) > 0 ? device.assetScale! : 1;
  const material = new THREE.MeshStandardMaterial({ color: device.color ?? '#dfaa55', roughness: 0.62 });
  const frame = new THREE.MeshStandardMaterial({ color: '#536b75', roughness: 0.42, metalness: 0.45 });
  const addBox = (
    target: THREE.Group,
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    surface: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width * scale, height * scale, depth * scale),
      surface,
    );
    mesh.position.set(x * scale, y * scale, z * scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    target.add(mesh);
  };
  const addChair = (target: THREE.Group, colorMaterial: THREE.Material) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.43 * scale, 0.08 * scale, 0.43 * scale), colorMaterial);
    seat.position.set(0, 0.25 * scale, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    target.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.43 * scale, 0.48 * scale, 0.08 * scale), colorMaterial);
    back.position.set(0, 0.52 * scale, 0.18 * scale);
    back.castShadow = true;
    target.add(back);
    for (const x of [-0.16, 0.16]) {
      for (const z of [-0.15, 0.15]) addBox(target, x, 0.12, z, 0.045, 0.25, 0.045, frame);
    }
  };

  if (device.type === 'chair') {
    addChair(group, material);
    return;
  }

  if (device.type === 'desk') {
    addBox(group, 0, 0.72, 0, 1.25, 0.08, 0.74, new THREE.MeshStandardMaterial({ color: '#d5c7ad', roughness: 0.62 }));
    for (const x of [-0.53, 0.53]) {
      for (const z of [-0.29, 0.29]) addBox(group, x, 0.36, z, 0.055, 0.68, 0.055, frame);
    }
    addBox(group, 0.18, 0.8, -0.08, 0.38, 0.04, 0.23, material);
    const chair = new THREE.Group();
    chair.position.z = 0.68 * scale;
    group.add(chair);
    addChair(chair, new THREE.MeshStandardMaterial({ color: '#7d97a2', roughness: 0.62 }));
    return;
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.52 * scale, 20), material);
  base.position.y = 0.28 * scale;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11 * scale, 16, 12),
    new THREE.MeshPhysicalMaterial({ color: '#78c8d5', roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.82 }),
  );
  beacon.position.y = 0.58 * scale;
  group.add(beacon);
}
