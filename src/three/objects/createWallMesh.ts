import * as THREE from 'three';
import type { Point2D, WallConfig } from '@/types/scene';

function pointDistance(start: Point2D, end: Point2D): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1]);
}

function createWallTagSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 28;
  const horizontalPadding = 18;
  const verticalPadding = 12;

  if (!context) {
    const fallbackMaterial = new THREE.SpriteMaterial({ color: '#7ed2ff' });
    return new THREE.Sprite(fallbackMaterial);
  }

  context.font = `600 ${fontSize}px Arial`;
  const metrics = context.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  canvas.width = textWidth + horizontalPadding * 2;
  canvas.height = fontSize + verticalPadding * 2;

  context.font = `600 ${fontSize}px Arial`;
  context.fillStyle = 'rgba(6, 20, 35, 0.9)';
  context.strokeStyle = 'rgba(126, 210, 255, 0.9)';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(1.5, 1.5, canvas.width - 3, canvas.height - 3, 12);
  context.fill();
  context.stroke();

  context.fillStyle = '#eaf7ff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = `wall-tag:${text}`;
  sprite.scale.set(canvas.width * 0.22, canvas.height * 0.22, 1);
  sprite.renderOrder = 20;

  return sprite;
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
  const tagSprite = createWallTagSprite(wall.id);

  wallMesh.position.y = wall.height / 2;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  tagSprite.position.set(0, wall.height + 10, 0);

  group.name = `wall:${wall.id}`;
  group.position.set(centerX, 0, centerZ);
  group.rotation.y = -angle;
  group.add(wallMesh, tagSprite);

  return group;
}
