import type { LivePose, PathPoint } from '@/three/TwinScene';
import { transformProtocolCoordinates } from '@/services/positionTransform';

export type MqttConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface MqttConnectionError {
  message: string;
  closeCode?: number;
  closeReason?: string;
  wasClean?: boolean;
}

interface OuterMqttMessage {
  type?: string;
  deviceId?: string;
  topic?: string;
  receivedAt?: string;
  payload?: string;
}

interface InnerPoseMessage {
  time?: number;
  x?: number;
  y?: number;
  z?: number;
  theta?: number;
}

interface MqttPoseClientOptions {
  url: string;
  onPose: (pose: LivePose) => void;
  onPath?: (deviceId: string, points: PathPoint[]) => void;
  onDeviceDisconnect?: (deviceId: string) => void;
  onStatusChange?: (status: MqttConnectionStatus) => void;
  onError?: (error: MqttConnectionError) => void;
  /** 超过该时长未收到设备任何消息即判定离线（默认 10s）。 */
  deviceTimeoutMs?: number;
  /** 离线检测轮询间隔（默认 2s）。 */
  deviceCheckIntervalMs?: number;
}

export class MqttPoseClient {
  private static readonly POSE_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/pose$/;
  private static readonly PATH_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/path$/;
  private static readonly DEVICE_EVENT_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/(disconnect|disconnected|offline|status|state)$/;
  private static readonly DEVICE_TOPIC_PATTERN = /^dfmotion\/([^/]+)\//;
  private static readonly DEFAULT_DEVICE_TIMEOUT_MS =  * 1000;
  private static readonly DEFAULT_DEVICE_CHECK_INTERVAL_MS = 2 * 1000;
  private static readonly DEBUG = true;
  private readonly url: string;
  private readonly onPose: (pose: LivePose) => void;
  private readonly onPath?: (deviceId: string, points: PathPoint[]) => void;
  private readonly onDeviceDisconnect?: (deviceId: string) => void;
  private readonly onStatusChange?: (status: MqttConnectionStatus) => void;
  private readonly onError?: (error: MqttConnectionError) => void;
  private readonly deviceTimeoutMs: number;
  private readonly deviceCheckIntervalMs: number;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private deviceCheckTimer: number | null = null;
  private manuallyClosed = false;
  private readonly pathSegments = new Map<string, Map<number, PathPoint[]>>();
  /** 设备最后一次收到消息的时间（毫秒时间戳），用于心跳超时离线判定。 */
  private readonly lastActivityAt = new Map<string, number>();

  constructor(options: MqttPoseClientOptions) {
    this.url = options.url;
    this.onPose = options.onPose;
    this.onPath = options.onPath;
    this.onDeviceDisconnect = options.onDeviceDisconnect;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;
    this.deviceTimeoutMs = options.deviceTimeoutMs ?? MqttPoseClient.DEFAULT_DEVICE_TIMEOUT_MS;
    this.deviceCheckIntervalMs = options.deviceCheckIntervalMs ?? MqttPoseClient.DEFAULT_DEVICE_CHECK_INTERVAL_MS;

  }

  connect(): void {

    this.manuallyClosed = false;
    this.clearReconnectTimer();
    this.onStatusChange?.('connecting');

    if (typeof WebSocket === 'undefined') {
      this.warn('connect aborted: WebSocket is not available in this runtime', { url: this.url });
      this.onStatusChange?.('error');
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {

      this.onStatusChange?.('connected');
    });

    socket.addEventListener('message', (event) => {

      // 收到设备相关消息即视为活跃，刷新离线超时计时。
      this.recordEnvelopeActivity(event.data);

      const pose = this.parsePose(event.data);
      if (pose) {

        this.onPose(pose);
        return;
      }

      const path = this.parsePath(event.data);
      if (path) {

        this.onPath?.(path.deviceId, path.points);
        return;
      }

      const disconnectedDeviceId = this.parseDeviceDisconnect(event.data);
      if (disconnectedDeviceId) {

        this.markDeviceOffline(disconnectedDeviceId);
        return;
      }

      this.warn('message ignored: did not match pose, path, or disconnect parsers', {
        rawData: event.data,
      });
    });

    socket.addEventListener('close', (event) => {
      this.warn('close event received', {
        url: this.url,
        manuallyClosed: this.manuallyClosed,
        readyState: socket.readyState,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.socket = null;
      if (this.manuallyClosed) {
        this.onStatusChange?.('disconnected');
        return;
      }

      console.error('MQTT WebSocket closed', {
        url: this.url,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.onError?.({
        message: 'WebSocket closed before a stable MQTT connection was established.',
        closeCode: event.code,
        closeReason: event.reason,
        wasClean: event.wasClean,
      });
      this.onStatusChange?.('error');
      this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
    });

    socket.addEventListener('error', () => {
      this.warn('error event received', {
        url: this.url,
        readyState: socket.readyState,
        protocol: socket.protocol,
      });
      console.error('MQTT WebSocket handshake failed', {
        url: this.url,
        readyState: socket.readyState,
      });
      this.onError?.({
        message: 'WebSocket handshake failed. Check endpoint, TLS certificate, auth, and server origin policy.',
      });
      this.onStatusChange?.('error');
    });

    this.startDeviceCheck();
  }

  disconnect(): void {

    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.clearDeviceCheck();
    this.socket?.close();
    this.socket = null;
    this.lastActivityAt.clear();
    this.onStatusChange?.('disconnected');
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 收到设备相关消息时刷新其离线计时。
   */
  private recordEnvelopeActivity(rawData: string): void {
    try {
      const outer = JSON.parse(rawData) as OuterMqttMessage;
      const topicMatch = outer.topic?.match(MqttPoseClient.DEVICE_TOPIC_PATTERN);
      const deviceId = topicMatch?.[1] ?? outer.deviceId ?? '';
      if (deviceId) {
        this.recordDeviceActivity(deviceId);
      }
    } catch {
      // 非 JSON 信封消息（如分段路径裸数据）由解析器自行刷新，这里忽略即可。
    }
  }

  private recordDeviceActivity(deviceId: string): void {
    if (!deviceId) {
      return;
    }

    this.lastActivityAt.set(deviceId, Date.now());
  }

  /**
   * 启动离线检测轮询：仅在 WebSocket 连接期间生效，
   * 对超过超时时间未收到任何消息的设备触发 onDeviceDisconnect。
   */
  private startDeviceCheck(): void {
    this.clearDeviceCheck();
    this.deviceCheckTimer = window.setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        return;
      }

      const now = Date.now();
      this.lastActivityAt.forEach((lastSeenAt, deviceId) => {
        if (now - lastSeenAt >= this.deviceTimeoutMs) {
          this.markDeviceOffline(deviceId);
        }
      });
    }, this.deviceCheckIntervalMs);
  }

  private clearDeviceCheck(): void {
    if (this.deviceCheckTimer !== null) {
      window.clearInterval(this.deviceCheckTimer);
      this.deviceCheckTimer = null;
    }
  }

  /**
   * 将设备标记为离线：清空其缓存与计时，并通知上层移除页面定位标记。
   */
  private markDeviceOffline(deviceId: string): void {
    this.lastActivityAt.delete(deviceId);
    this.pathSegments.delete(deviceId);
    this.onDeviceDisconnect?.(deviceId);
  }

  private warn(message: string, details?: unknown): void {
    if (!MqttPoseClient.DEBUG) {
      return;
    }

    console.warn(`[MqttPoseClient] ${message}`, details ?? '');
  }

  private parsePose(rawData: string): LivePose | null {
    try {
      const outer = JSON.parse(rawData) as OuterMqttMessage;

      if (outer.type !== 'mqtt' || !outer.payload) {

        return null;
      }

      const topicMatch = outer.topic?.match(MqttPoseClient.POSE_TOPIC_PATTERN);
      if (!topicMatch) {

        return null;
      }

      const payload = JSON.parse(outer.payload) as InnerPoseMessage;
      const rawX = Number(payload.x);
      const rawY = Number(payload.y);
      const z = Number(payload.z ?? 0);
      const theta = Number(payload.theta ?? 0);
      const { x, y } = this.transformCoordinates(rawX, rawY);

      if (![rawX, rawY, x, y, z, theta].every((value) => Number.isFinite(value))) {

        return null;
      }

      return {
        deviceId: topicMatch[1] ?? outer.deviceId ?? '',
        x,
        y,
        z,
        theta,
        time: this.normalizeTimestamp(payload.time ?? outer.receivedAt),
        receivedAt: outer.receivedAt,
      };
    } catch (error) {
      console.error('Failed to parse MQTT pose message', error);
      return null;
    }
  }

  private parsePath(rawData: string): { deviceId: string; points: PathPoint[] } | null {
    try {
      const outer = JSON.parse(rawData) as OuterMqttMessage;

      if (outer.type !== 'mqtt' || !outer.payload) {

        return null;
      }

      const topicMatch = outer.topic?.match(MqttPoseClient.PATH_TOPIC_PATTERN);
      if (!topicMatch) {

        return null;
      }

      const deviceId = topicMatch[1] ?? outer.deviceId ?? '';
      const normalizedPayload = outer.payload.trim();
      if (normalizedPayload === 'end') {
        const points = this.flushPathSegments(deviceId);

        return points.length > 0 ? { deviceId, points } : null;
      }

      const values = this.parsePathPayloadValues(normalizedPayload);

      if (!values || values.length < 4) {

        return null;
      }

      const index = values[0];
      if (!Number.isInteger(index)) {

        return null;
      }

      const points = this.parsePathPoints(values.slice(1));

      if (points.length === 0) {

        return null;
      }

      const segments = this.pathSegments.get(deviceId) ?? new Map<number, PathPoint[]>();
      segments.set(index, points);
      this.pathSegments.set(deviceId, segments);

      return null;
    } catch (error) {
      console.error('Failed to parse MQTT path message', error);
      return null;
    }
  }

  private parsePathPayloadValues(payload: string): number[] | null {
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        const values = parsed.map((item) => Number(item));
        return values.every((value) => Number.isFinite(value)) ? values : null;
      }
    } catch {
      // Fall through to comma-separated parsing.
    }

    const values = payload
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => Number(item));

    return values.length > 0 && values.every((value) => Number.isFinite(value)) ? values : null;
  }

  private parsePathPoints(values: number[]): PathPoint[] {
    const timedPoints = this.parseTimedPathPoints(values);
    if (timedPoints.length > 0) {
      return timedPoints;
    }

    const points: PathPoint[] = [];
    for (let i = 0; i + 2 < values.length; i += 3) {
      const point = this.createPathPoint(values[i], values[i + 1], values[i + 2]);
      if (point) {
        points.push(point);
      }
    }
    return points;
  }

  private parseTimedPathPoints(values: number[]): PathPoint[] {
    if (values.length < 4 || values.length % 4 !== 0) {
      return [];
    }

    const xyzTimePoints = this.parseTimedPathPointsWithLayout(values, 'xyzTime');
    if (xyzTimePoints.length > 0) {
      return xyzTimePoints;
    }

    return this.parseTimedPathPointsWithLayout(values, 'timeXyz');
  }

  private parseTimedPathPointsWithLayout(values: number[], layout: 'xyzTime' | 'timeXyz'): PathPoint[] {
    const points: PathPoint[] = [];
    for (let i = 0; i + 3 < values.length; i += 4) {
      const rawTime = layout === 'xyzTime' ? values[i + 3] : values[i];
      const time = this.normalizeTimestamp(rawTime);
      if (typeof time !== 'number') {
        return [];
      }

      const rawX = layout === 'xyzTime' ? values[i] : values[i + 1];
      const rawY = layout === 'xyzTime' ? values[i + 1] : values[i + 2];
      const z = layout === 'xyzTime' ? values[i + 2] : values[i + 3];
      const point = this.createPathPoint(rawX, rawY, z);
      if (!point) {
        return [];
      }

      points.push({ ...point, time });
    }

    return points;
  }

  private createPathPoint(rawX: number, rawY: number, z: number): PathPoint | null {
    const { x, y } = this.transformCoordinates(rawX, rawY);
    if (![rawX, rawY, x, y, z].every((value) => Number.isFinite(value))) {
      return null;
    }

    return { x, y, z };
  }

  private parseDeviceDisconnect(rawData: string): string | null {
    try {
      const outer = JSON.parse(rawData) as OuterMqttMessage;
      if (outer.type !== 'mqtt') {
        return null;
      }

      const topicMatch = outer.topic?.match(MqttPoseClient.DEVICE_EVENT_TOPIC_PATTERN);
      if (!topicMatch) {
        return null;
      }

      const deviceId = topicMatch[1] ?? outer.deviceId ?? '';
      if (!deviceId) {
        return null;
      }

      const eventType = topicMatch[2];
      if (eventType === 'disconnect' || eventType === 'disconnected' || eventType === 'offline') {
        return deviceId;
      }

      const payload = outer.payload?.trim();
      if (!payload) {
        return null;
      }

      if (['disconnect', 'disconnected', 'offline', 'false', '0'].includes(payload.toLowerCase())) {
        return deviceId;
      }

      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        if (
          parsed.online === false ||
          parsed.connected === false ||
          parsed.status === 'offline' ||
          parsed.status === 'disconnected' ||
          parsed.state === 'offline' ||
          parsed.state === 'disconnected'
        ) {
          return deviceId;
        }
      } catch {
        // Ignore non-JSON payloads that don't match the simple string cases above.
      }

      return null;
    } catch (error) {
      console.error('Failed to parse MQTT device disconnect message', error);
      return null;
    }
  }

  private flushPathSegments(deviceId: string): PathPoint[] {
    const segments = this.pathSegments.get(deviceId);
    if (!segments) {
      return [];
    }

    const points = [...segments.entries()]
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .flatMap(([, segmentPoints]) => segmentPoints);

    this.pathSegments.delete(deviceId);
    return points;
  }

  private transformCoordinates(x2: number, y2: number): { x: number; y: number } {
    return transformProtocolCoordinates(x2, y2);
  }

  private normalizeTimestamp(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'string') {
      const parsedDate = Date.parse(value);
      if (Number.isFinite(parsedDate)) {
        return parsedDate;
      }
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return undefined;
    }

    if (numericValue >= 1e17) {
      return Math.round(numericValue / 1e6);
    }

    if (numericValue >= 1e14) {
      return Math.round(numericValue / 1e3);
    }

    if (numericValue >= 1e12) {
      return Math.round(numericValue);
    }

    if (numericValue >= 1e9) {
      return Math.round(numericValue * 1000);
    }

    return undefined;
  }
}
