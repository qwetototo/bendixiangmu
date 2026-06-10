import * as THREE from 'three';
import type { FenceConfig } from '@/types/scene';

function createFenceLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color }));
  }

  const fontSize = 24;
  const paddingX = 16;
  const paddingY = 10;
  context.font = `700 ${fontSize}px Arial`;
  const width = Math.ceil(context.measureText(text).width + paddingX * 2);
  const height = fontSize + paddingY * 2;
  canvas.width = width;
  canvas.height = height;

  context.font = `700 ${fontSize}px Arial`;
  context.fillStyle = 'rgba(5, 16, 31, 0.82)';
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(1.5, 1.5, width - 3, height - 3, 10);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.name = `fence-label:${text}`;
  sprite.scale.set(width * 0.18, height * 0.18, 1);
  sprite.renderOrder = 32;
  return sprite;
}

export function createFenceMesh(fence: FenceConfig, showLabel = true): THREE.Group {
  const width = Math.max(fence.maxX - fence.minX, 1);
  const depth = Math.max(fence.maxY - fence.minY, 1);
  const centerX = (fence.minX + fence.maxX) / 2;
  const centerZ = (fence.minY + fence.maxY) / 2;
  const color = fence.color || '#2f86ff';
  const group = new THREE.Group();
  group.name = `fence:${fence.id}`;

  // 创建底面矩形填充
  const fillGeometry = new THREE.PlaneGeometry(width, depth);
  const fillMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.name = `fence-fill:${fence.id}`;
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(centerX, 2, centerZ);
  fill.renderOrder = 29;
  group.add(fill);

  // 创建边框线
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const points = [
    new THREE.Vector3(centerX - halfWidth, 2, centerZ - halfDepth),
    new THREE.Vector3(centerX + halfWidth, 2, centerZ - halfDepth),
    new THREE.Vector3(centerX + halfWidth, 2, centerZ + halfDepth),
    new THREE.Vector3(centerX - halfWidth, 2, centerZ + halfDepth),
    new THREE.Vector3(centerX - halfWidth, 2, centerZ - halfDepth),
  ];
  const border = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, linewidth: 2 }),
  );
  border.name = `fence-border:${fence.id}`;
  border.renderOrder = 30;
  group.add(border);

  // 添加标签
  if (showLabel) {
    const label = createFenceLabel(fence.name, color);
    label.position.set(centerX, 18, centerZ - halfDepth);
    group.add(label);
  }

  return group;
}
