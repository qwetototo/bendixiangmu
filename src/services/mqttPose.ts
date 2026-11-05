import type { LivePose, PathPoint } from '@/three/TwinScene';
import { transformProtocolCoordinates } from '@/services/positionTransform';

export type MqttConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface MqttConnectionError {
  message: string;
  closeCode?: number;
  closeReason?: string;
  wasClean?: boolean;
}

/**
 * 设备实时告警（MQTT topic dfmotion/{deviceId}/sos）。
 * payload 为分号分隔：时间戳;告警类型;附加信息。
 */
export interface DeviceAlarmEvent {
  deviceId: string;
  /** 上报时间戳原始字符串（单位由设备协议决定，未做换算）。 */
  timestamp: string;
  /** 告警类型：0=SOS 报警、1=人员跌倒、2=低电量，其他保留扩展。 */
  alarmType: number;
  /** 附加信息。 */
  extra: string;
  raw: string;
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

interface PendingPath {
  segments: Map<number, PathPoint[]>;
  updatedAt: number;
  pointCount: number;
}

interface MqttPoseClientOptions {
  url: string;
  onPose: (pose: LivePose) => void;
  onPath?: (deviceId: string, points: PathPoint[]) => void;
  onAlarm?: (alarm: DeviceAlarmEvent) => void;
  onDeviceDisconnect?: (deviceId: string) => void;
  onStatusChange?: (status: MqttConnectionStatus) => void;
  onError?: (error: MqttConnectionError) => void;
  /** 超过该时长未收到设备任何消息即判定离线（默认 60s）。 */
  deviceTimeoutMs?: number;
  /** 离线检测轮询间隔（默认 2s）。 */
  deviceCheckIntervalMs?: number;
}

export class MqttPoseClient {
  private static readonly POSE_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/pose$/;
  private static readonly PATH_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/path$/;
  private static readonly ALARM_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/sos$/;
  private static readonly DEVICE_EVENT_TOPIC_PATTERN = /^dfmotion\/([^/]+)\/(disconnect|disconnected|offline|status|state)$/;
  private static readonly DEVICE_TOPIC_PATTERN = /^dfmotion\/([^/]+)\//;
  private static readonly DEFAULT_DEVICE_TIMEOUT_MS = 60 * 1000;
  private static readonly DEFAULT_DEVICE_CHECK_INTERVAL_MS = 2 * 1000;
  private static readonly CONNECT_TIMEOUT_MS = 15 * 1000;
  private static readonly MESSAGE_TIMEOUT_MS = 90 * 1000;
  private static readonly PATH_TIMEOUT_MS = 2 * 60 * 1000;
  private static readonly MAX_PATH_SEGMENTS = 500;
  private static readonly MAX_PATH_POINTS = 10000;
  private static readonly DEBUG = false;
  private readonly url: string;
  private readonly onPose: (pose: LivePose) => void;
  private readonly onPath?: (deviceId: string, points: PathPoint[]) => void;
  private readonly onAlarm?: (alarm: DeviceAlarmEvent) => void;
  private readonly onDeviceDisconnect?: (deviceId: string) => void;
  private readonly onStatusChange?: (status: MqttConnectionStatus) => void;
  private readonly onError?: (error: MqttConnectionError) => void;
  private readonly deviceTimeoutMs: number;
  private readonly deviceCheckIntervalMs: number;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private connectTimer: number | null = null;
  private deviceCheckTimer: number | null = null;
  private manuallyClosed = false;
  private readonly pathSegments = new Map<string, PendingPath>();
  private readonly rejectedPaths = new Set<string>();
  private lastMessageAt = 0;
  private hasReceivedMessage = false;
  private reconnectAttempts = 0;
  private listeningForWake = false;
  private readonly handleWake = (): void => {
    if (this.manuallyClosed) return;
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      if (this.hasReceivedMessage && Date.now() - this.lastMessageAt >= MqttPoseClient.MESSAGE_TIMEOUT_MS) {
        this.failConnection(socket, 'WebSocket stopped receiving messages.');
      }
    } else if (socket?.readyState === WebSocket.CONNECTING) {
      if (Date.now() - this.lastMessageAt >= MqttPoseClient.CONNECT_TIMEOUT_MS) {
        this.failConnection(socket, 'WebSocket connection timed out.');
      }
    } else if (!socket || socket.readyState === WebSocket.CLOSED) {
      this.clearReconnectTimer();
      this.connect();
    }
  };
  private readonly handleVisibilityChange = (): void => {
    if (!document.hidden) this.handleWake();
  };
  /** 设备最后一次收到消息的时间（毫秒时间戳），用于心跳超时离线判定。 */
  private readonly lastActivityAt = new Map<string, number>();

  constructor(options: MqttPoseClientOptions) {
    this.url = options.url;
    this.onPose = options.onPose;
    this.onPath = options.onPath;
    this.onAlarm = options.onAlarm;
    this.onDeviceDisconnect = options.onDeviceDisconnect;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;
    this.deviceTimeoutMs = options.deviceTimeoutMs ?? MqttPoseClient.DEFAULT_DEVICE_TIMEOUT_MS;
    this.deviceCheckIntervalMs = options.deviceCheckIntervalMs ?? MqttPoseClient.DEFAULT_DEVICE_CHECK_INTERVAL_MS;

  }

  connect(): void {
    this.manuallyClosed = false;
    this.clearReconnectTimer();

    if (typeof WebSocket === 'undefined') {
      this.warn('connect aborted: WebSocket is not available in this runtime', { url: this.url });
      this.onStatusChange?.('error');
      return;
    }
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;
    this.onStatusChange?.('connecting');
    if (!this.listeningForWake) {
      window.addEventListener('online', this.handleWake);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.listeningForWake = true;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.lastMessageAt = Date.now();
    this.hasReceivedMessage = false;
    this.connectTimer = window.setTimeout(() => {
      if (this.socket === socket && socket.readyState === WebSocket.CONNECTING) {
        this.failConnection(socket, 'WebSocket connection timed out.');
      }
    }, MqttPoseClient.CONNECT_TIMEOUT_MS);

    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.clearConnectTimer();
      this.lastMessageAt = Date.now();
      this.onStatusChange?.('connected');
      this.startDeviceCheck();
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) return;
      this.lastMessageAt = Date.now();
      this.hasReceivedMessage = true;
      this.reconnectAttempts = 0;
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
      if (this.isPathMessage(event.data)) return;

      const disconnectedDeviceId = this.parseDeviceDisconnect(event.data);
      if (disconnectedDeviceId) {

        this.markDeviceOffline(disconnectedDeviceId);
        return;
      }

      const alarm = this.parseAlarm(event.data);
      if (alarm) {

        this.onAlarm?.(alarm);
        return;
      }

      this.warn('message ignored: did not match pose, path, disconnect, or alarm parsers', {
        rawData: event.data,
      });
    });

    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      this.warn('close event received', {
        url: this.url,
        manuallyClosed: this.manuallyClosed,
        readyState: socket.readyState,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.clearConnectTimer();
      this.clearDeviceCheck();
      this.socket = null;
      this.clearDeviceCache();
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
        message: 'WebSocket connection closed.',
        closeCode: event.code,
        closeReason: event.reason,
        wasClean: event.wasClean,
      });
      this.onStatusChange?.('error');
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (this.socket !== socket) return;
      this.warn('error event received', {
        url: this.url,
        readyState: socket.readyState,
        protocol: socket.protocol,
      });
      console.error('MQTT WebSocket error', {
        url: this.url,
        readyState: socket.readyState,
      });
      this.onError?.({
        message: 'WebSocket error. Check the endpoint, network, TLS certificate, and server logs.',
      });
      this.onStatusChange?.('error');
    });
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.listeningForWake) {
      window.removeEventListener('online', this.handleWake);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.listeningForWake = false;
    }
    this.clearReconnectTimer();
    this.clearConnectTimer();
    this.clearDeviceCheck();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.clearDeviceCache(false);
    this.onStatusChange?.('disconnected');
  }

  private failConnection(socket: WebSocket, message: string): void {
    if (this.socket !== socket || this.manuallyClosed) return;
    this.socket = null;
    this.clearConnectTimer();
    this.clearDeviceCheck();
    socket.close();
    this.clearDeviceCache();
    this.onError?.({ message });
    this.onStatusChange?.('error');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    if (!this.manuallyClosed) {
      const delay = Math.min(3000 * 2 ** Math.min(this.reconnectAttempts, 4), 30000);
      this.reconnectAttempts += 1;
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearDeviceCache(notify = true): void {
    const deviceIds = notify ? [...this.lastActivityAt.keys()] : [];
    this.lastActivityAt.clear();
    this.pathSegments.clear();
    this.rejectedPaths.clear();
    deviceIds.forEach((deviceId) => this.onDeviceDisconnect?.(deviceId));
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
      if (this.hasReceivedMessage && now - this.lastMessageAt >= MqttPoseClient.MESSAGE_TIMEOUT_MS) {
        this.failConnection(this.socket, 'WebSocket stopped receiving messages.');
        return;
      }
      this.lastActivityAt.forEach((lastSeenAt, deviceId) => {
        if (now - lastSeenAt >= this.deviceTimeoutMs) {
          this.markDeviceOffline(deviceId);
        }
      });
      this.pathSegments.forEach((path, deviceId) => {
        if (now - path.updatedAt >= MqttPoseClient.PATH_TIMEOUT_MS) {
          this.pathSegments.delete(deviceId);
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
    this.rejectedPaths.delete(deviceId);
    this.onDeviceDisconnect?.(deviceId);
  }

  private warn(message: string, details?: unknown): void {
    if (!MqttPoseClient.DEBUG) {
      return;
    }

    console.warn(`[MqttPoseClient] ${message}`, details ?? '');
  }

  private isPathMessage(rawData: string): boolean {
    try {
      const outer = JSON.parse(rawData) as OuterMqttMessage;
      return outer.type === 'mqtt' && MqttPoseClient.PATH_TOPIC_PATTERN.test(outer.topic ?? '');
    } catch {
      return false;
    }
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
        protocolX: rawX,
        protocolY: rawY,
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
        if (this.rejectedPaths.delete(deviceId)) return null;
        const points = this.flushPathSegments(deviceId);

        return points.length > 0 ? { deviceId, points } : null;
      }
      if (this.rejectedPaths.has(deviceId)) return null;

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

      const pending = this.pathSegments.get(deviceId) ?? {
        segments: new Map<number, PathPoint[]>(),
        updatedAt: Date.now(),
        pointCount: 0,
      };
      const priorCount = pending.segments.get(index)?.length ?? 0;
      const nextPointCount = pending.pointCount - priorCount + points.length;
      if (
        (!pending.segments.has(index) && pending.segments.size >= MqttPoseClient.MAX_PATH_SEGMENTS) ||
        nextPointCount > MqttPoseClient.MAX_PATH_POINTS
      ) {
        this.pathSegments.delete(deviceId);
        this.rejectedPaths.add(deviceId);
        console.warn('[MqttPoseClient] incomplete path exceeded cache limit', { deviceId });
        return null;
      }
      pending.segments.set(index, points);
      pending.pointCount = nextPointCount;
      pending.updatedAt = Date.now();
      this.pathSegments.set(deviceId, pending);

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

    return { x, y, z, protocolX: rawX, protocolY: rawY };
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

  private parseAlarm(rawData: string): DeviceAlarmEvent | null {
    try {
      const outer = JSON.parse(rawData) as OuterMqttMessage;

      if (outer.type !== 'mqtt' || !outer.payload) {

        return null;
      }

      const topicMatch = outer.topic?.match(MqttPoseClient.ALARM_TOPIC_PATTERN);
      if (!topicMatch) {

        return null;
      }

      const fields = outer.payload.split(';').map((field) => field.trim());
      const alarmType = Number(fields[1]);
      if (!Number.isInteger(alarmType) || alarmType < 0) {

        return null;
      }

      return {
        deviceId: topicMatch[1] ?? outer.deviceId ?? '',
        timestamp: fields[0] ?? '',
        alarmType,
        extra: fields[2] ?? '',
        raw: outer.payload,
      };
    } catch (error) {
      console.error('Failed to parse MQTT alarm message', error);
      return null;
    }
  }

  private flushPathSegments(deviceId: string): PathPoint[] {
    const pending = this.pathSegments.get(deviceId);
    if (!pending) {
      return [];
    }

    const points = [...pending.segments.entries()]
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
