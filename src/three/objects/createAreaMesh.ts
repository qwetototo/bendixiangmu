import * as THREE from 'three';
import type { AreaConfig, Point2D } from '@/types/scene';

function toVector(point: Point2D): THREE.Vector2 {
  return new THREE.Vector2(point[0], point[1]);
}

export function createAreaMesh(area: AreaConfig): THREE.Mesh {
  const shape = new THREE.Shape(area.points.map(toVector));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: area.height,
    bevelEnabled: false,
  });

  // Rotate the extruded geometry so height grows along the Y axis.
  geometry.rotateX(-Math.PI / 2);
  // Keep the area's Z direction consistent with walls/devices, which use point[1] as +Z.
  geometry.scale(1, 1, -1);

  const material = new THREE.MeshStandardMaterial({
    color: area.color,
    transparent: true,
    opacity: area.opacity,
    emissive: new THREE.Color(area.color).multiplyScalar(0.12),
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `area:${area.id}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = 0.02;

  return mesh;
}
