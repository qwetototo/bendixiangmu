import axios from 'axios';
import type { PathPoint } from '@/three/TwinScene';

export interface TrajectoryQuery {
  deviceId?: string;
  startTime: number;
  endTime: number;
}

export interface TrajectoryReplayPoint extends PathPoint {
  deviceId: string;
  theta?: number;
  time: number;
}

interface TrajectoryPointVO {
  deviceId?: string;
  x?: number;
  y?: number;
  z?: number;
  theta?: number;
  timestamp?: string | number;
  time?: string | number;
  serverTs?: string | number;
}

interface TrajectoryResponseVO {
  data?: TrajectoryPointVO[];
}

const DEFAULT_TRAJECTORY_API_URL = '/api/trajectory/points';
const SCENE_UNITS_PER_MM = 0.01;
const RADIANS_PER_MRAD = 0.001;

// 时间戳诊断函数（开发调试用）
export function diagnoseTimestamp(value: unknown): {
  originalValue: unknown;
  normalizedMs: number;
  readableDate: string;
  detectedFormat: string;
} {
  const normalized = normalizeTimestamp(value);
  const YEAR_2000_MS = 946684800000;
  const YEAR_2100_MS = 4102444800000;

  let detectedFormat = 'unknown';
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    detectedFormat = 'invalid';
  } else if (numericValue >= YEAR_2000_MS && numericValue <= YEAR_2100_MS) {
    detectedFormat = 'milliseconds';
  } else if (numericValue >= 1e14 && numericValue < 1e16) {
    detectedFormat = 'microseconds';
  } else if (numericValue >= 1e17) {
    detectedFormat = 'nanoseconds';
  } else if (numericValue >= 1e9 && numericValue < YEAR_2000_MS) {
    detectedFormat = 'seconds';
  }

  return {
    originalValue: value,
    normalizedMs: normalized,
    readableDate: Number.isFinite(normalized) ? new Date(normalized).toISOString() : 'Invalid',
    detectedFormat,
  };
}

export async function fetchTrajectoryPoints(query: TrajectoryQuery): Promise<TrajectoryReplayPoint[]> {
  const endpoint = import.meta.env.VITE_TRAJECTORY_API_URL?.trim() || DEFAULT_TRAJECTORY_API_URL;
  const response = await axios.get<TrajectoryPointVO[] | TrajectoryResponseVO>(endpoint, {
    params: {
      deviceId: query.deviceId || undefined,
      startTime: query.startTime,
      endTime: query.endTime,
    },
  });

  const points = Array.isArray(response.data) ? response.data : response.data.data ?? [];

  return points
    .map(normalizeTrajectoryPoint)
    .filter((point): point is TrajectoryReplayPoint => point !== null)
    .sort((left, right) => left.time - right.time);
}

function normalizeTrajectoryPoint(point: TrajectoryPointVO): TrajectoryReplayPoint | null {
  const deviceId = point.deviceId?.trim();
  const x = normalizeCoordinate(point.x);
  const y = normalizeCoordinate(point.y);
  const z = normalizeCoordinate(point.z ?? 0);
  const theta = normalizeTheta(point.theta ?? 0);
  const time = normalizeTimestamp(point.timestamp ?? point.time ?? point.serverTs);

  if (!deviceId || ![x, y, z, theta, time].every((value) => Number.isFinite(value))) {
    return null;
  }

  return {
    deviceId,
    x,
    y,
    z,
    theta,
    time,
  };
}

function normalizeCoordinate(value: unknown): number {
  return Number(value) * SCENE_UNITS_PER_MM;
}

function normalizeTheta(value: unknown): number {
  return Number(value) * RADIANS_PER_MRAD;
}

function normalizeTimestamp(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return Number.NaN;
  }

  // 2000-2100年对应的毫秒级时间戳范围（约1e12-1.3e12）
  const YEAR_2000_MS = 946684800000;  // 2000-01-01 00:00:00 UTC
  const YEAR_2100_MS = 4102444800000; // 2100-01-01 00:00:00 UTC

  // 优先判断是否已经是毫秒级（最常见的情况）
  if (numericValue >= YEAR_2000_MS && numericValue <= YEAR_2100_MS) {
    return Math.round(numericValue);
  }

  // 纳秒级（1e18-1e19）
  if (numericValue >= 1e17) {
    const converted = Math.round(numericValue / 1e6);
    if (converted >= YEAR_2000_MS && converted <= YEAR_2100_MS) {
      return converted;
    }
  }

  // 微秒级（1e14-1e15）
  if (numericValue >= 1e14 && numericValue < 1e16) {
    const converted = Math.round(numericValue / 1e3);
    if (converted >= YEAR_2000_MS && converted <= YEAR_2100_MS) {
      return converted;
    }
  }

  // 秒级（1e9-1e12）
  if (numericValue >= 1e9 && numericValue < YEAR_2000_MS) {
    const converted = Math.round(numericValue * 1000);
    if (converted >= YEAR_2000_MS && converted <= YEAR_2100_MS) {
      return converted;
    }
  }

  return Number.NaN;
}
