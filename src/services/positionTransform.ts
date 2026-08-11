import type { SavedMap } from '@/services/mapLibrary';

/**
 * 将 UWB 定位协议坐标（米）映射到 3D 场景坐标的变换。
 *
 * 默认值针对内置默认地图标定：UWB 原点 (0,0) 落在场景 (-84.95, 79.67)，
 * 1 米真实距离对应 14.5 个场景单位。
 */
export interface PositionTransform {
  scale: number;
  xOffset: number;
  zOffset: number;
}

export const DEFAULT_POSITION_TRANSFORM: PositionTransform = {
  scale: 14.5,
  xOffset: -84.95,
  zOffset: 79.67,
};

/** 默认地图的 scaleRatio（floor.scale），模型以该倍数放大到场景尺寸。 */
export const DEFAULT_MAP_SCALE_RATIO = 14.5;

let currentTransform: PositionTransform = { ...DEFAULT_POSITION_TRANSFORM };

export function setPositionTransform(transform: PositionTransform): void {
  currentTransform = { ...transform };
}

export function getPositionTransform(): PositionTransform {
  return { ...currentTransform };
}

export function transformProtocolCoordinates(x: number, y: number): { x: number; y: number } {
  return {
    x: currentTransform.scale * x + currentTransform.xOffset,
    y: currentTransform.scale * -y + currentTransform.zOffset,
  };
}

/**
 * 从地图 metadata 派生定位坐标变换。
 *
 * - xOffset / zOffset 绑定地图的 positioningOrigin（场景坐标中 UWB 原点 (0,0)
 *   的位置）。默认或未配置时 positioningOrigin 为 [0,0,0]，视为未配置，
 *   回退到默认偏移，保证旧数据行为不变。
 * - scale 随地图 scaleRatio 线性推导：模型放大 scaleRatio 倍后，米→场景单位
 *   也按相同倍数放大。
 */
export function derivePositionTransform(map: SavedMap): PositionTransform {
  const origin = map.metadata.positioningOrigin;
  // const scaleRatio = map.metadata.scaleRatio;
  // const resolvedRatio =
  //   Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : DEFAULT_MAP_SCALE_RATIO;
  const configured = Boolean(origin) && (origin[0] !== 0 || origin[1] !== 0);

  return {
    // scale: DEFAULT_POSITION_TRANSFORM.scale * (resolvedRatio / DEFAULT_MAP_SCALE_RATIO),
    scale: DEFAULT_POSITION_TRANSFORM.scale,
    xOffset: configured ? origin[0] : DEFAULT_POSITION_TRANSFORM.xOffset,
    zOffset: configured ? origin[1] : DEFAULT_POSITION_TRANSFORM.zOffset,
  };
}
