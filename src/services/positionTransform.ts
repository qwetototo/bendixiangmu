import type { SavedMap } from '@/services/mapLibrary';

/**
 * 将 UWB 定位协议坐标（米）映射到 3D 场景坐标的变换。
 *
 * 默认变换为中性值：1 场景单位 = 1 米，UWB 原点 (0,0) 即场景坐标 (0,0)。
 * 内置模板地图（overlay 底图）的旧标定值（scale 14.5 / 偏移 -84.95, 79.67）
 * 固化在其 metadata（calibrationScale / positioningOrigin），由 derivePositionTransform
 * 读取，不依赖这里的默认值，因此模板地图行为保持不变。
 */
export interface PositionTransform {
  scale: number;
  xOffset: number;
  zOffset: number;
}

export const DEFAULT_POSITION_TRANSFORM: PositionTransform = {
  scale: 1,
  xOffset: 0,
  zOffset: 0,
};

let currentTransform: PositionTransform = { ...DEFAULT_POSITION_TRANSFORM };

export function setPositionTransform(transform: PositionTransform): void {
  currentTransform = { ...transform };
}

export function transformProtocolCoordinates(x: number, y: number): { x: number; y: number } {
  return {
    x: currentTransform.scale * x + currentTransform.xOffset,
    y: currentTransform.scale * -y + currentTransform.zOffset,
  };
}

/**
 * TwinScene / ConfigView 对底图 GLB 施加的最终缩放：model.scale * (floor.scale / DEFAULT_MODEL_SCALE_RATIO)。
 * 底图模型以 1 单位 = 1 米制作时，该值即"1 米对应的场景单位数"。
 */
const DEFAULT_MODEL_SCALE_RATIO = 1;

/**
 * 从地图 metadata 派生定位坐标变换。
 *
 * - xOffset / zOffset 绑定地图的 positioningOrigin（场景坐标中 UWB 原点 (0,0)
 *   的位置）。默认或未配置时 positioningOrigin 为 [0,0,0]，视为未配置，
 *   回退到默认偏移，保证旧数据行为不变。
 * - scale 三级优先：
 *   1. 地图的 calibrationScale（两点标定得到的绝对测量值，场景单位/米）；
 *   2. 存在 base-map GLB 时按 model.scale * (floor.scale / DEFAULT_MODEL_SCALE_RATIO) 推导；
 *   3. 回退到默认 1（1 场景单位 = 1 米）。
 *
 *   内置模板地图没有 base-map 模型，但 getDefaultMap 在其 metadata 写入了
 *   calibrationScale=14.5 与 positioningOrigin，因此仍走第 1 级，行为与旧默认值一致。
 */
export function derivePositionTransform(map: SavedMap): PositionTransform {
  const origin = map.metadata.positioningOrigin;
  const configured = Boolean(origin) && (origin[0] !== 0 || origin[1] !== 0);

  // 1) 显式标定值优先。
  const rawCalibrationScale = Number(map.metadata.calibrationScale);
  const calibrated =
    Number.isFinite(rawCalibrationScale) && rawCalibrationScale > 0 ? rawCalibrationScale : undefined;

  // 2) 无标定值时，若存在 base-map GLB，按 TwinScene 相同的最终缩放推导。
  const baseMapModel = map.config.models.find((model) => model.role === 'base-map');
  const floorScale = Number(map.config.floor.scale);
  const scaleRatioFactor =
    baseMapModel && Number.isFinite(floorScale) && floorScale > 0 ? floorScale / DEFAULT_MODEL_SCALE_RATIO : 1;
  const baseModelScale = baseMapModel ? Number(baseMapModel.scale) : NaN;
  const baseMapScale =
    baseMapModel && Number.isFinite(baseModelScale) && baseModelScale > 0
      ? baseModelScale * scaleRatioFactor
      : undefined;

  return {
    scale: calibrated ?? baseMapScale ?? DEFAULT_POSITION_TRANSFORM.scale,
    xOffset: configured ? origin[0] : DEFAULT_POSITION_TRANSFORM.xOffset,
    zOffset: configured ? origin[1] : DEFAULT_POSITION_TRANSFORM.zOffset,
  };
}
